import { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ───────────────── UTILS ───────────────── */
const parseCoordinate = (value) => {
  const parts = String(value || "").split(",").map((s) => s.trim());
  if (parts.length !== 2) return null;

  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);

  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
};

const formatCoordinate = (lat, lng) => {
  if (lat == null || lng == null) return "";
  return `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;
};

/* ───────────────── MAP CLICK HANDLER ───────────────── */
const MapClickHandler = ({ onLocationSelect }) => {
  useMapEvents({
    click: (e) => onLocationSelect(e.latlng.lat, e.latlng.lng),
  });
  return null;
};

/* ───────────────── MAIN COMPONENT ───────────────── */
export default function EditLocation({
  show,
  user,
  routerId,
  onClose,
  onSaved,
}) {
  const [coordInput, setCoordInput] = useState("");
  const [mapPreview, setMapPreview] = useState({ lat: null, lng: null });
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /* ✅ FIX: hooks harus di atas sebelum conditional return */
  const handleMapSelect = useCallback((lat, lng) => {
    setMapPreview({ lat, lng });
    setCoordInput(formatCoordinate(lat, lng));
    setError("");
  }, []);

  // Reset state when modal opens/closes or user changes
  useEffect(() => {
    if (show && user) {
      const lat = user.latitude ?? user.lat ?? null;
      const lng = user.longitude ?? user.lng ?? null;

      setCoordInput(formatCoordinate(lat, lng));
      setMapPreview({ lat, lng });
      setError("");
    } else if (!show) {
      setCoordInput("");
      setMapPreview({ lat: null, lng: null });
      setShowMapPicker(false);
      setError("");
    }
  }, [show, user]);

  if (!show) return null;

  const handleCoordChange = (value) => {
    setCoordInput(value);
    setError("");

    const parsed = parseCoordinate(value);

    if (value.trim() && !parsed) {
      setError("Format tidak valid. Gunakan: -6.2088, 106.8456");
    } else if (parsed) {
      setMapPreview(parsed);
    }
  };

  const handleSave = async () => {
    if (!routerId || !user?.id || !mapPreview.lat) {
      setError("Koordinat harus dipilih sebelum menyimpan!");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(
        `http://localhost:3000/api/pppoe/${routerId}/user/${user.id}/location`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: mapPreview.lat,
            longitude: mapPreview.lng,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success)
        throw new Error(json.message || "Gagal update lokasi");

      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || "Gagal menyimpan lokasi");
    } finally {
      setSaving(false);
    }
  };

  const clearLocation = () => {
    setCoordInput("");
    setMapPreview({ lat: null, lng: null });
    setError("");
  };

  return (
    <>
      <style>{`
        .leaflet-container { width: 100%; height: 300px; border-radius: 8px; z-index: 0; }
        .map-picker-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 2000; display: flex; align-items: center; justify-content: center; }
        .map-picker-content { background: #fff; border-radius: 12px; width: 90%; max-width: 800px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
        .coord-preview { font-size: 0.85rem; color: #666; }
        .coord-preview.valid { color: #198754; font-weight: 500; }
        .coord-preview.invalid { color: #dc3545; }
      `}</style>

      {/* MAIN MODAL */}
      <div
        className="modal fade show d-block"
        tabIndex="-1"
        style={{ background: "rgba(0,0,0,0.5)", zIndex: 1050 }}
        onClick={onClose}
      >
        <div
          className="modal-dialog modal-dialog-centered"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-pin-map-fill me-2"></i>Edit Koordinat User
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
              />
            </div>

            <div className="modal-body">
              <p className="text-muted small mb-3">
                Setting coordinates for: <strong>{user?.username}</strong>
              </p>

              <div className="mb-3">
                <label className="form-label small fw-semibold">
                  Koordinat (Latitude, Longitude)
                </label>

                <div className="input-group">
                  <span className="input-group-text">
                    <i className="bi bi-geo-alt"></i>
                  </span>

                  <input
                    type="text"
                    className={`form-control ${error ? "is-invalid" : ""}`}
                    placeholder="-6.2088, 106.8456"
                    value={coordInput}
                    onChange={(e) => handleCoordChange(e.target.value)}
                  />
                </div>

                {error && (
                  <div className="invalid-feedback d-block">{error}</div>
                )}

                <small className="text-muted">
                  Format: <code>latitude, longitude</code>
                </small>
              </div>

              <div className="mb-3 p-3 bg-light rounded">
                <div className="d-flex justify-content-between flex-wrap gap-2">
                  <span
                    className={`coord-preview ${
                      error ? "invalid" : coordInput ? "valid" : ""
                    }`}
                  >
                    {mapPreview.lat != null
                      ? `📍 ${formatCoordinate(
                          mapPreview.lat,
                          mapPreview.lng
                        )}`
                      : "Belum ada lokasi dipilih"}
                  </span>

                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => setShowMapPicker(true)}
                    >
                      <i className="bi bi-map me-1"></i>Pilih di Peta
                    </button>

                    {mapPreview.lat != null && (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={clearLocation}
                        >
                          <i className="bi bi-x-circle"></i>
                        </button>

                        <a
                          href={`https://maps.google.com/?q=${mapPreview.lat},${mapPreview.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline-secondary"
                        >
                          <i className="bi bi-box-arrow-up-right"></i>
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>
                Batal
              </button>

              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !mapPreview.lat}
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MAP PICKER */}
      {showMapPicker && (
        <div
          className="map-picker-modal"
          onClick={() => setShowMapPicker(false)}
        >
          <div
            className="map-picker-content"
            onClick={(e) => e.stopPropagation()}
          >
            <MapContainer
              center={
                mapPreview.lat != null
                  ? [mapPreview.lat, mapPreview.lng]
                  : [-6.2088, 106.8456]
              }
              zoom={mapPreview.lat != null ? 15 : 10}
              scrollWheelZoom
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              <MapClickHandler onLocationSelect={handleMapSelect} />

              {mapPreview.lat != null && (
                <Marker position={[mapPreview.lat, mapPreview.lng]} />
              )}
            </MapContainer>
          </div>
        </div>
      )}
    </>
  );
}