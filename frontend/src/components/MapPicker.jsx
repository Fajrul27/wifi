import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, CircleMarker, Tooltip } from "react-leaflet";
import api from "../services/api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Parse berbagai format koordinat dari Google Maps ──────────────────────────
function parseCoordInput(raw) {
  if (!raw) return null;
  const s = raw.trim();

  // Format 1: "-6.1234, 106.8456" atau "-6.1234 106.8456"
  const decimalMatch = s.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
  if (decimalMatch) {
    const lat = parseFloat(decimalMatch[1]);
    const lng = parseFloat(decimalMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // Format 2: DMS seperti "7°31'04.7\"S 109°03'59.5\"E"
  const dmsMatch = s.match(
    /(\d+)°\s*(\d+)'\s*(\d+\.?\d*)["″]?\s*([NSNS])\s+(\d+)°\s*(\d+)'\s*(\d+\.?\d*)["″]?\s*([EWew])/i
  );
  if (dmsMatch) {
    const toDecimal = (d, m, sc, dir) => {
      const dec = Number(d) + Number(m) / 60 + Number(sc) / 3600;
      return ['S', 's', 'W', 'w'].includes(dir) ? -dec : dec;
    };
    const lat = toDecimal(dmsMatch[1], dmsMatch[2], dmsMatch[3], dmsMatch[4]);
    const lng = toDecimal(dmsMatch[5], dmsMatch[6], dmsMatch[7], dmsMatch[8]);
    return { lat, lng };
  }

  // Format 3: Google Maps URL — ?q=-6.1234,106.8456 atau @-6.1234,106.8456
  const urlMatch = s.match(/[?@](-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (urlMatch) {
    return { lat: parseFloat(urlMatch[1]), lng: parseFloat(urlMatch[2]) };
  }

  return null;
}

// ─── Internal components ────────────────────────────────────────────────────
function ClickHandler({ onPick }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function FlyToPin({ lat, lng }) {
  const map = useMap();
  const prev = useRef({ lat, lng });
  useEffect(() => {
    if (!lat || !lng) return;
    const p = prev.current;
    if (p.lat !== lat || p.lng !== lng) {
      prev.current = { lat, lng };
      map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { animate: true, duration: 0.7 });
    }
  }, [lat, lng, map]);
  return null;
}

// ─── MapPicker utama ─────────────────────────────────────────────────────────
/**
 * Props:
 *   lat, lng           — koordinat saat ini (number | string | "")
 *   onChange(lat, lng) — callback saat user klik peta atau paste koordinat
 *   height             — tinggi peta css (default 300)
 */
export default function MapPicker({ lat, lng, onChange, height = 300 }) {
  const [pasteInput, setPasteInput] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [otherDevices, setOtherDevices] = useState([]);

  useEffect(() => {
    const fetchOtherDevices = async () => {
      try {
        const [routersRes, topologyRes, oltsRes] = await Promise.allSettled([
          api.get("/routers"),
          api.get("/topology"),
          api.get("/olts/olt")
        ]);

        const devices = [];

        if (routersRes.status === "fulfilled") {
          const data = routersRes.value?.data || [];
          data.forEach(r => {
            if (r.latitude && r.longitude) {
              devices.push({
                id: `router-${r.id}`,
                name: r.name,
                type: "Router",
                lat: Number(r.latitude),
                lng: Number(r.longitude)
              });
            }
          });
        }

        if (topologyRes.status === "fulfilled") {
          const resData = topologyRes.value?.data;
          const data = Array.isArray(resData) ? resData : (Array.isArray(resData?.data) ? resData.data : []);
          data.forEach(n => {
            if (n.latitude && n.longitude) {
              devices.push({
                id: `node-${n.id}`,
                name: n.name,
                type: n.type,
                lat: Number(n.latitude),
                lng: Number(n.longitude)
              });
            }
          });
        }

        if (oltsRes.status === "fulfilled") {
          const resData = oltsRes.value?.data;
          const data = Array.isArray(resData) ? resData : (Array.isArray(resData?.data) ? resData.data : []);
          data.forEach(o => {
            if (o.latitude && o.longitude) {
              devices.push({
                id: `olt-${o.id}`,
                name: o.name,
                type: "OLT",
                lat: Number(o.latitude),
                lng: Number(o.longitude)
              });
            }
          });
        }

        setOtherDevices(devices);
      } catch (err) {
        console.error("Failed to fetch other devices for MapPicker:", err);
      }
    };

    fetchOtherDevices();
  }, []);

  const hasPin = lat !== "" && lng !== "" && !isNaN(Number(lat)) && !isNaN(Number(lng));
  const numLat = hasPin ? Number(lat) : null;
  const numLng = hasPin ? Number(lng) : null;
  const center = hasPin ? [numLat, numLng] : [-2.5, 118.0];
  const initZoom = hasPin ? 16 : 5;

  const displayOtherDevices = otherDevices.filter(dev => {
    if (hasPin) {
      const distance = Math.abs(dev.lat - numLat) + Math.abs(dev.lng - numLng);
      return distance > 0.00001;
    }
    return true;
  });

  // Auto-parse saat user ketik/paste
  const handlePasteInput = (val) => {
    setPasteInput(val);
    setPasteError("");
    if (!val.trim()) return;
    const parsed = parseCoordInput(val);
    if (parsed) {
      onChange(parsed.lat, parsed.lng);
      setPasteError("");
    }
  };

  const handlePasteSubmit = () => {
    if (!pasteInput.trim()) return;
    const parsed = parseCoordInput(pasteInput);
    if (parsed) {
      onChange(parsed.lat, parsed.lng);
      setPasteError("");
    } else {
      setPasteError("Format tidak dikenali. Coba: -6.1234, 106.8456");
    }
  };

  return (
    <div>
      {/* ── Input salin dari Google Maps ── */}
      <div className="mb-2">
        <label className="form-label small fw-semibold mb-1">
          <i className="bi bi-clipboard-data me-1 text-primary"></i>
          Tempel koordinat dari Google Maps
        </label>
        <div className="input-group input-group-sm">
          <span className="input-group-text bg-white">
            <i className="bi bi-geo-alt text-danger"></i>
          </span>
          <input
            type="text"
            className={`form-control ${pasteError ? 'is-invalid' : ''}`}
            placeholder='-6.123456, 106.123456  atau  7°31′04.7″S 109°03′59.5″E  atau URL Google Maps'
            value={pasteInput}
            onChange={(e) => handlePasteInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePasteSubmit()}
          />
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={handlePasteSubmit}
            title="Terapkan koordinat"
          >
            <i className="bi bi-pin-map-fill"></i>
          </button>
          {hasPin && (
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => {
                setPasteInput("");
                onChange("", "");
              }}
              title="Hapus pin"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          )}
        </div>
        {pasteError && <div className="invalid-feedback d-block small">{pasteError}</div>}
        <div className="form-text" style={{ fontSize: 11 }}>
          💡 Di Google Maps: klik kanan lokasi → salin koordinat, lalu tempel di sini.
          Atau tempel langsung URL Google Maps.
        </div>
      </div>

      {/* ── Peta Interaktif ── */}
      <div style={{
        position: "relative",
        borderRadius: 10,
        overflow: "hidden",
        border: "2px solid #dee2e6",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}>
        {/* Badge instruksi */}
        <div style={{
          position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: "rgba(0,0,0,0.68)", color: "#fff",
          padding: "4px 14px", borderRadius: 20, fontSize: 12,
          pointerEvents: "none", whiteSpace: "nowrap",
        }}>
          <i className="bi bi-cursor me-1"></i>
          {hasPin ? "Klik peta untuk pindah pin" : "Klik peta untuk menandai lokasi"}
        </div>

        {/* Badge koordinat */}
        {hasPin && (
          <div style={{
            position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
            zIndex: 1000, background: "rgba(255,255,255,0.93)",
            padding: "4px 14px", borderRadius: 20, fontSize: 12,
            boxShadow: "0 1px 6px rgba(0,0,0,0.18)", whiteSpace: "nowrap",
          }}>
            <i className="bi bi-geo-alt-fill text-danger me-1"></i>
            {numLat.toFixed(6)}, {numLng.toFixed(6)}
            <a
              href={`https://maps.google.com/?q=${numLat},${numLng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ms-2 text-primary text-decoration-none"
              title="Buka di Google Maps"
              style={{ fontSize: 11 }}
            >
              <i className="bi bi-box-arrow-up-right"></i>
            </a>
          </div>
        )}

        <MapContainer
          center={center}
          zoom={initZoom}
          style={{ height, width: "100%" }}
          zoomControl={true}
          attributionControl={false}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <InvalidateOnMount />
          <ClickHandler onPick={onChange} />
          {hasPin && (
            <>
              <FlyToPin lat={numLat} lng={numLng} />
              <Marker position={[numLat, numLng]} />
            </>
          )}
          {displayOtherDevices.map(dev => (
            <CircleMarker
              key={dev.id}
              center={[dev.lat, dev.lng]}
              radius={6}
              pathOptions={{
                fillColor: dev.type === "Router" ? "#3b82f6" :
                           dev.type === "OLT" ? "#8b5cf6" :
                           dev.type === "ODC" ? "#06b6d4" :
                           dev.type === "ODP" ? "#f59e0b" : "#94a3b8",
                color: "#ffffff",
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.8
              }}
            >
              <Tooltip direction="top" offset={[0, -5]} opacity={0.9}>
                <span><strong>[{dev.type}]</strong> {dev.name}</span>
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
