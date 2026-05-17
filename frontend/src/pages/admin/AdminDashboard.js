// components/FtthTopologyMap.jsx
import React, { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import api from "../../services/api";
import { socket } from "../../services/socket";

// Fix default Leaflet marker icons (untuk webpack/Vite)
const iconAnchor = [12, 41];
const popupAnchor = [1, -34];

const createCustomIcon = (color, iconClass, isOffline = false) => {
  const pulseHtml = isOffline ? `
    <div style="
      position: absolute;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(239, 68, 68, 0.35);
      border: 2px solid rgba(239, 68, 68, 0.8);
      animation: radar-pulse 1.8s infinite ease-out;
      z-index: 1;
    "></div>
  ` : '';

  return L.divIcon({
    className: "custom-marker",
    html: `
      <style>
        @keyframes radar-pulse {
          0% { transform: scale(0.45); opacity: 0.9; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      </style>
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;">
        ${pulseHtml}
        <div style="
          background: ${color};
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 3px 8px rgba(0,0,0,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          z-index: 10;
        "><i class="bi ${iconClass}"></i></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor,
    popupAnchor,
  });
};

// Marker icons by entity type
const MARKER_CONFIG = {
  router: { color: "#0ea5e9", icon: "bi-router-fill", label: "Router" },
  oltPort: { color: "#2563eb", icon: "bi-hdd-rack-fill", label: "OLT Port" },
  ODC: { color: "#8b5cf6", icon: "bi-hdd-network-fill", label: "ODC" },
  ODP: { color: "#f59e0b", icon: "bi-modem-fill", label: "ODP", textColor: "#212529" },
  splitter: { color: "#ea580c", icon: "bi-diagram-3-fill", label: "Splitter" },
  client: { color: "#10b981", icon: "bi-pc-display-horizontal", label: "Client" },
};

// Component to auto-fit map bounds to markers
function FitMapBounds({ coordinates, selectedRouter }) {
  const map = useMap();
  const prevRouterRef = useRef(undefined);
  const hasFittedRef = useRef(false);
  
  useEffect(() => {
    if (coordinates?.length > 0) {
      if (!hasFittedRef.current || prevRouterRef.current !== selectedRouter) {
        const validCoords = coordinates.filter(c => c && c.lat && c.lng && !isNaN(c.lat) && !isNaN(c.lng) && c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180);
        if (validCoords.length > 0) {
          const bounds = L.latLngBounds(validCoords.map(c => [c.lat, c.lng]));
          map.fitBounds(bounds.pad(0.1));
          hasFittedRef.current = true;
          prevRouterRef.current = selectedRouter;
        }
      }
    }
  }, [coordinates, selectedRouter, map]);
  
  return null;
}

export default function FtthTopologyMap({ 
  routers: propRouters = [], 
  oltPorts: propOltPorts = [], 
  nodes: propNodes = [], 
  splitters: propSplitters = [], 
  pppoeUsers: propUsers = [],
  selectedRouter: propSelectedRouter = null,
  onNodeClick = null,
  onOltPortClick = null,
  height = "calc(100vh - 100px)"
}) {
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [mapCenter, setMapCenter] = useState([-6.2088, 106.8456]); // Default: Jakarta
  const [mapInstance, setMapInstance] = useState(null);

  const [apiRouters, setApiRouters] = useState([]);
  const [apiOltPorts, setApiOltPorts] = useState([]);
  const [apiNodes, setApiNodes] = useState([]);
  const [apiSplitters, setApiSplitters] = useState([]);
  const [apiUsers, setApiUsers] = useState([]);
  const [apiSelectedRouter, setApiSelectedRouter] = useState(null);
  const [loading, setLoading] = useState(false);

  const isStandalone = propRouters.length === 0;

  const routers = isStandalone ? apiRouters : propRouters;
  const oltPorts = isStandalone ? apiOltPorts : propOltPorts;
  const nodes = isStandalone ? apiNodes : propNodes;
  // eslint-disable-next-line no-unused-vars
  const splitters = isStandalone ? apiSplitters : propSplitters;
  const pppoeUsers = isStandalone ? apiUsers : propUsers;
  const selectedRouter = isStandalone ? apiSelectedRouter : propSelectedRouter;

  useEffect(() => {
    if (!isStandalone) return;
    setLoading(true);
    Promise.allSettled([
      api.get("/routers"),
      api.get("/topology"),
      api.get("/splitter"),
    ]).then(async ([routerRes, nodesRes, splittersRes]) => {
      const extractData = (res) => {
        if (res?.status !== 'fulfilled') return [];
        if (Array.isArray(res.value?.data?.data)) return res.value.data.data;
        if (Array.isArray(res.value?.data)) return res.value.data;
        return [];
      };

      const loadedRouters = extractData(routerRes);
      setApiRouters(loadedRouters);
      setApiNodes(extractData(nodesRes));
      setApiSplitters(extractData(splittersRes));

      let currentRouterId = null;
      if (loadedRouters.length > 0) {
        currentRouterId = loadedRouters[0].id;
        setApiSelectedRouter(currentRouterId);
      }

      if (currentRouterId) {
        const [oltRes, usersRes] = await Promise.allSettled([
          api.get(`/olt-ports/router/${currentRouterId}`),
          api.get(`/pppoe/${currentRouterId}`)
        ]);
        setApiOltPorts(extractData(oltRes));
        setApiUsers(extractData(usersRes));
      }
    }).finally(() => setLoading(false));
  }, [isStandalone]);

  // 🔌 Socket realtime — update langsung dari payload tanpa API call (Hanya jika isStandalone)
  useEffect(() => {
    if (!isStandalone || !selectedRouter) return;

    // ─── Update status topologi node (misal ada perubahan status dari backend) ───
    const handleTopologyStatus = (data) => {
      if (Number(data?.routerId) !== Number(selectedRouter)) return;
      // Jika ada kebutuhan update node di masa depan
    };

    // ─── Update status user PPPoE LANGSUNG dari socket (tanpa API call) ───
    const handlePppoeRealtime = (data) => {
      if (Number(data?.routerId) !== Number(selectedRouter)) return;
      const incoming = data?.data;
      if (!Array.isArray(incoming) || incoming.length === 0) return;

      setApiUsers((prev) => {
        const map = new Map(prev.map((u) => [u.id, u]));
        for (const r of incoming) {
          const old = map.get(r.id) || {};
          map.set(r.id, {
            ...old,
            id: r.id,
            username: r.username || old.username,
            isOnline: !!r.isOnline,
            profile: r.profile || old.profile || '-',
            remoteAddress: r.remoteAddress || old.remoteAddress || null,
            localAddress: r.localAddress || old.localAddress || null,
            uptime: r.isOnline ? (r.uptime || null) : null,
            lastSeen: r.lastSeen || old.lastSeen,
            lastDisconnect: r.lastDisconnect || old.lastDisconnect,
          });
        }
        return Array.from(map.values());
      });
    };

    socket.on("topology-status-realtime", handleTopologyStatus);
    socket.on("pppoe-realtime", handlePppoeRealtime);

    return () => {
      socket.off("topology-status-realtime", handleTopologyStatus);
      socket.off("pppoe-realtime", handlePppoeRealtime);
    };
  }, [isStandalone, selectedRouter]);

  // Filter data by selected router
  const filteredOltPorts = useMemo(() => {
    return selectedRouter 
      ? oltPorts.filter(p => p.routerId === Number(selectedRouter))
      : oltPorts;
  }, [oltPorts, selectedRouter]);

  const filteredNodes = useMemo(() => {
    return selectedRouter 
      ? nodes.filter(n => {
          if (n.oltPortId) {
            const port = oltPorts.find(p => p.id === n.oltPortId);
            return port?.routerId === Number(selectedRouter);
          }
          return true;
        })
      : nodes;
  }, [nodes, oltPorts, selectedRouter]);

  const filteredUsers = useMemo(() => {
    return selectedRouter
      ? pppoeUsers.filter(u => {
          if (u.topologyNodeId) {
            const node = nodes.find(n => n.id === u.topologyNodeId);
            if (node?.oltPortId) {
              const port = oltPorts.find(p => p.id === node.oltPortId);
              return port?.routerId === Number(selectedRouter);
            }
          }
          return true;
        })
      : pppoeUsers;
  }, [pppoeUsers, nodes, oltPorts, selectedRouter]);

  // Helper to validate coordinates
  const isValidCoord = (lat, lng) => {
    const numLat = Number(lat);
    const numLng = Number(lng);
    return !isNaN(numLat) && !isNaN(numLng) && numLat !== 0 && numLng !== 0 && numLat >= -90 && numLat <= 90 && numLng >= -180 && numLng <= 180;
  };

  // Collect all coordinates for auto-fit
  const allCoordinates = useMemo(() => {
    const coords = [];
    
    routers.forEach(r => { 
      if (isValidCoord(r.latitude, r.longitude)) coords.push({ lat: Number(r.latitude), lng: Number(r.longitude) }); 
    });
    filteredOltPorts.forEach(p => { 
      if (isValidCoord(p.latitude, p.longitude)) coords.push({ lat: Number(p.latitude), lng: Number(p.longitude) }); 
    });
    filteredNodes.forEach(n => { 
      if (isValidCoord(n.latitude, n.longitude)) coords.push({ lat: Number(n.latitude), lng: Number(n.longitude) }); 
    });
    filteredUsers.forEach(u => { 
      if (isValidCoord(u.latitude, u.longitude)) coords.push({ lat: Number(u.latitude), lng: Number(u.longitude) }); 
    });
    
    return coords;
  }, [routers, filteredOltPorts, filteredNodes, filteredUsers]);

  // Update map center when coordinates available
  useEffect(() => {
    if (allCoordinates.length > 0) {
      const valid = allCoordinates.filter(c => c && isValidCoord(c.lat, c.lng));
      if (valid.length > 0) {
        const avgLat = valid.reduce((sum, c) => sum + c.lat, 0) / valid.length;
        const avgLng = valid.reduce((sum, c) => sum + c.lng, 0) / valid.length;
        setMapCenter([avgLat, avgLng]);
      }
    }
  }, [allCoordinates]);

  // Helper: cek apakah sebuah node (ODC/ODP) memiliki setidaknya 1 user online di bawahnya (termasuk anak cabangnya)
  const hasOnlineUser = useCallback((nodeId) => {
    const directUsers = filteredUsers.filter(u => u.topologyNodeId === nodeId);
    if (directUsers.some(u => u.isOnline)) return true;
    const childNodes = filteredNodes.filter(n => (n.incomingLinks?.[0]?.fromNodeId || n.parentNodeId) === nodeId);
    return childNodes.some(child => hasOnlineUser(child.id));
  }, [filteredUsers, filteredNodes]);

  // Helper: cek apakah node ini memiliki user sama sekali (langsung atau di anak cabang)
  const hasAnyUser = useCallback((nodeId) => {
    const directUsers = filteredUsers.filter(u => u.topologyNodeId === nodeId);
    if (directUsers.length > 0) return true;
    const childNodes = filteredNodes.filter(n => (n.incomingLinks?.[0]?.fromNodeId || n.parentNodeId) === nodeId);
    return childNodes.some(child => hasAnyUser(child.id));
  }, [filteredUsers, filteredNodes]);

  // Build topology connections (lines)
  const connections = useMemo(() => {
    const lines = [];

    // OLT Port → ODC connections (Hanya untuk ROOT ODC yang tidak memiliki parent/incoming link)
    filteredNodes.filter(n => n.type === 'ODC' && n.oltPortId && !n.incomingLinks?.length && !n.parentNodeId).forEach(node => {
      const port = filteredOltPorts.find(p => p.id === node.oltPortId);
      if (isValidCoord(port?.latitude, port?.longitude) && isValidCoord(node.latitude, node.longitude)) {
        const anyUser = hasAnyUser(node.id);
        const isOnline = anyUser ? hasOnlineUser(node.id) : true;
        lines.push({
          id: `olt-${node.id}`,
          coordinates: [[Number(port.latitude), Number(port.longitude)], [Number(node.latitude), Number(node.longitude)]],
          type: 'olt-to-odc',
          color: !anyUser ? '#94a3b8' : (isOnline ? '#2563eb' : '#ef4444'),
          weight: !anyUser ? 3 : (isOnline ? 4 : 5),
          dashArray: !anyUser ? '4,4' : (isOnline ? undefined : '8,6'),
          label: !anyUser ? `Kabel Feeder OLT ➔ ${node.name} (Belum ada pelanggan)` : (isOnline ? `Kabel Feeder OLT ➔ ${node.name} (Aktif)` : `⚠️ KABEL FEEDER PUTUS: OLT ➔ ${node.name} Total Offline!`),
          sublabel: !anyUser ? 'Jalur pasif' : (isOnline ? 'Transmisi GPON Normal' : 'Periksa SFP OLT atau kabel utama fiber optik'),
        });
      }
    });

    // Parent Node → Child Node connections
    filteredNodes.forEach(node => {
      const parentId = node.incomingLinks?.[0]?.fromNodeId || node.parentNodeId;
      if (parentId) {
        const parent = filteredNodes.find(n => n.id === parentId);
        if (isValidCoord(parent?.latitude, parent?.longitude) && isValidCoord(node.latitude, node.longitude)) {
          const anyUser = hasAnyUser(node.id);
          const isOnline = anyUser ? hasOnlineUser(node.id) : true;
          const isODP = node.type === 'ODP';
          
          let defaultColor = isODP ? '#f59e0b' : '#8b5cf6';
          let lineColor = !anyUser ? '#94a3b8' : (isOnline ? defaultColor : '#ef4444');
          let lineWeight = !anyUser ? 3 : (isOnline ? 4 : 5);
          let lineDash = !anyUser ? '4,4' : (isOnline ? undefined : '8,6');
          let labelText = !anyUser ? `Kabel Distribusi ${parent.name} ➔ ${node.name} (Kosong)` : (isOnline ? `Kabel Distribusi ${parent.name} ➔ ${node.name} (Aktif)` : `⚠️ KABEL DISTRIBUSI PUTUS: ${parent.name} ➔ ${node.name}`);
          let subText = !anyUser ? 'Belum ada pelanggan aktif' : (isOnline ? 'Koneksi optik lancar' : `Semua pelanggan di bawah ${node.name} terputus serentak!`);

          lines.push({
            id: `node-${node.id}`,
            coordinates: [[Number(parent.latitude), Number(parent.longitude)], [Number(node.latitude), Number(node.longitude)]],
            type: node.type === 'ODP' ? 'odc-to-odp' : 'node-to-node',
            color: lineColor,
            weight: lineWeight,
            dashArray: lineDash,
            label: labelText,
            sublabel: subText,
          });
        }
      }
    });

    // ODP → Client connections (via splitter outputs)
    filteredUsers.forEach(user => {
      if (user.topologyNodeId) {
        const node = filteredNodes.find(n => n.id === user.topologyNodeId);
        if (isValidCoord(user.latitude, user.longitude) && isValidCoord(node?.latitude, node?.longitude) && node?.type === 'ODP') {
          const isUserOnline = user.isOnline;
          lines.push({
            id: `client-${user.id}`,
            coordinates: [[Number(node.latitude), Number(node.longitude)], [Number(user.latitude), Number(user.longitude)]],
            type: 'odp-to-client',
            color: isUserOnline ? '#10b981' : '#ef4444',
            weight: isUserOnline ? 3 : 4,
            dashArray: isUserOnline ? undefined : '6,6',
            label: isUserOnline ? `Kabel Drop: ${node.name} ➔ ${user.username} (ONLINE)` : `⚠️ KABEL DROP PUTUS / ONT MATI: ${node.name} ➔ ${user.username}`,
            sublabel: isUserOnline ? `IP: ${user.remoteAddress || '-'}` : 'Pelanggan offline / ONT dimatikan / Kabel drop terputus',
          });
        }
      }
    });

    return lines;
  }, [filteredOltPorts, filteredNodes, filteredUsers, hasOnlineUser, hasAnyUser]);

  // Handle marker click
  const handleMarkerClick = useCallback((entity, type) => {
    setSelectedEntity({ ...entity, _type: type });
    if (type === 'oltPort' && onOltPortClick) {
      onOltPortClick(entity.id);
    } else if (type === 'node' && onNodeClick) {
      onNodeClick(entity.id);
    }
  }, [onNodeClick, onOltPortClick]);

  // Close detail panel
  const closeDetail = () => setSelectedEntity(null);

  // Legend component
  const MapLegend = () => (
    <div className="card border-0 shadow position-absolute" style={{ 
      bottom: '20px', right: '20px', zIndex: 1000, width: '250px',
      background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)',
      borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)'
    }}>
      <div className="card-body py-3 px-3" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        <h6 className="fw-bold mb-3 small text-dark border-bottom pb-2">🗺️ Peta Legend & Status</h6>
        
        {/* Section 1: Perangkat & Status */}
        <div className="mb-3">
          <span className="text-uppercase fw-bold text-muted d-block mb-2" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Perangkat / Entitas</span>
          <div className="d-flex flex-column gap-2">
            {Object.entries(MARKER_CONFIG)
              .filter(([key]) => key !== 'splitter')
              .map(([key, config]) => (
              <div key={key} className="d-flex align-items-center gap-2 small">
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: config.color, border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: 'white',
                  flexShrink: 0
                }}>
                  <i className={`bi ${config.icon}`} style={{ fontSize: '10px' }}></i>
                </div>
                <span className="text-dark fw-medium small">{config.label}</span>
              </div>
            ))}
            {/* Offline Client Beacon */}
            <div className="d-flex align-items-center gap-2 small">
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%',
                background: '#ef4444', border: '2px solid white',
                boxShadow: '0 0 8px rgba(239,68,68,0.8)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: 'white',
                flexShrink: 0
              }}>
                <i className="bi bi-pc-display-horizontal" style={{ fontSize: '10px' }}></i>
              </div>
              <span className="text-danger fw-bold small">Client Offline (Radar)</span>
            </div>
          </div>
        </div>

        {/* Section 2: Status Kabel */}
        <div>
          <span className="text-uppercase fw-bold text-muted d-block mb-2" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Status Jalur Kabel</span>
          <div className="d-flex flex-column gap-2 small">
            <div className="d-flex align-items-center gap-2">
              <div style={{ width: '24px', height: '4px', background: '#2563eb', borderRadius: '2px', flexShrink: 0 }}></div>
              <span className="text-dark small">Kabel Feeder (OLT ➔ ODC)</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div style={{ width: '24px', height: '4px', background: '#8b5cf6', borderRadius: '2px', flexShrink: 0 }}></div>
              <span className="text-dark small">Kabel Sub-ODC (ODC ➔ ODC)</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div style={{ width: '24px', height: '4px', background: '#f59e0b', borderRadius: '2px', flexShrink: 0 }}></div>
              <span className="text-dark small">Kabel Distribusi (ODC ➔ ODP)</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div style={{ width: '24px', height: '3px', background: '#10b981', borderRadius: '2px', flexShrink: 0 }}></div>
              <span className="text-dark small">Kabel Drop (ODP ➔ Client)</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div style={{ width: '24px', height: '4px', background: '#ef4444', borderBottom: '2px dashed white', flexShrink: 0 }}></div>
              <span className="text-danger fw-bold small">⚠️ Kabel Putus / Offline</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div style={{ width: '24px', height: '3px', background: '#94a3b8', borderBottom: '2px dotted white', flexShrink: 0 }}></div>
              <span className="text-muted small">Jalur Pasif / Kosong</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );

  // Detail sidebar component
  const DetailPanel = () => {
    if (!selectedEntity) return null;
    
    const config = MARKER_CONFIG[selectedEntity._type] || MARKER_CONFIG.client;
    const title = selectedEntity.name || selectedEntity.username || `${config.label} #${selectedEntity.id}`;
    
    return (
      <div className="card border-0 shadow position-absolute" style={{
        top: '20px', right: '20px', zIndex: 1000, width: '320px',
        background: 'white', borderRadius: '12px', maxHeight: '80vh', overflow: 'auto'
      }}>
        <div className="card-header bg-white border-bottom py-2 px-3 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%',
              background: config.color, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'white'
            }}>
              <i className={`bi ${config.icon}`} style={{ fontSize: '12px' }}></i>
            </div>
            <h6 className="mb-0 fw-semibold text-dark">{title}</h6>
          </div>
          <button className="btn-close btn-sm" onClick={closeDetail}></button>
        </div>
        
        <div className="card-body py-3 px-3">
          {/* Router Details */}
          {selectedEntity._type === 'router' && (
            <>
              <div className="mb-2"><small className="text-muted">Host</small><br/><strong className="text-dark">{selectedEntity.host}</strong></div>
              <div className="mb-2"><small className="text-muted">Status</small><br/>{selectedEntity.isOnline ? <span className="badge bg-success">Online</span> : <span className="badge bg-secondary">Offline</span>}</div>
              {selectedEntity.latitude && selectedEntity.longitude && (
                <div className="mb-2">
                  <small className="text-muted">Coordinates</small><br/>
                  <strong className="text-dark">{selectedEntity.latitude?.toFixed(4)}, {selectedEntity.longitude?.toFixed(4)}</strong>
                </div>
              )}
            </>
          )}

          {/* OLT Port Details */}
          {selectedEntity._type === 'oltPort' && (
            <>
              <div className="mb-2"><small className="text-muted">Interface</small><br/><code className="text-dark bg-light px-2 py-1 rounded">{selectedEntity.port}</code></div>
              <div className="mb-2"><small className="text-muted">Router</small><br/><strong className="text-dark">{selectedEntity.router?.name || `Router #${selectedEntity.routerId}`}</strong></div>
              <div className="mb-2"><small className="text-muted">Connected Nodes</small><br/><strong className="text-dark">{nodes.filter(n => n.oltPortId === selectedEntity.id).length}</strong></div>
              {selectedEntity.latitude && selectedEntity.longitude && (
                <a href={`https://maps.google.com/?q=${selectedEntity.latitude},${selectedEntity.longitude}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary w-100">
                  <i className="bi bi-map me-1"></i>Open in Google Maps
                </a>
              )}
            </>
          )}

          {/* Node Details (ODC/ODP) */}
          {selectedEntity._type === 'node' && (
            <>
              <div className="mb-2"><small className="text-muted">Type</small><br/><span className={`badge ${selectedEntity.type === 'ODP' ? 'bg-warning text-dark' : 'bg-success'}`}>{selectedEntity.type}</span></div>
              {selectedEntity.description && (
                <div className="mb-2"><small className="text-muted">Description</small><br/><span className="text-dark">{selectedEntity.description}</span></div>
              )}
              {selectedEntity.cableType && (
                <div className="mb-2"><small className="text-muted">Cable</small><br/><span className="text-dark">{selectedEntity.cableType?.replace(/_/g, ' ')} ({selectedEntity.totalCore} core)</span></div>
              )}
              {selectedEntity.distanceMeter && (
                <div className="mb-2"><small className="text-muted">Distance</small><br/><span className="text-dark">{selectedEntity.distanceMeter} meters</span></div>
              )}
              {selectedEntity.latitude && selectedEntity.longitude && (
                <a href={`https://maps.google.com/?q=${selectedEntity.latitude},${selectedEntity.longitude}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary w-100 mt-2">
                  <i className="bi bi-map me-1"></i>Open in Google Maps
                </a>
              )}
            </>
          )}

          {/* Client Details */}
          {selectedEntity._type === 'client' && (
            <>
              <div className="mb-2"><small className="text-muted">IP Address</small><br/><code className="text-dark bg-light px-2 py-1 rounded">{selectedEntity.remoteAddress || '—'}</code></div>
              <div className="mb-2"><small className="text-muted">Status</small><br/>{selectedEntity.isOnline ? <span className="badge bg-success">Online</span> : <span className="badge bg-secondary">Offline</span>}</div>
              {selectedEntity.topologyNodeId && (
                <div className="mb-2"><small className="text-muted">Connected To</small><br/><strong className="text-dark">{nodes.find(n => n.id === selectedEntity.topologyNodeId)?.name || `Node #${selectedEntity.topologyNodeId}`}</strong></div>
              )}
              {selectedEntity.latitude && selectedEntity.longitude && (
                <a href={`https://maps.google.com/?q=${selectedEntity.latitude},${selectedEntity.longitude}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary w-100 mt-2">
                  <i className="bi bi-house me-1"></i>View Customer Location
                </a>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // Stats overlay
  const StatsOverlay = () => (
    <div className="card border-0 shadow-sm position-absolute" style={{
      top: '20px', left: '20px', zIndex: 1000, background: 'white',
      borderRadius: '8px', minWidth: '220px'
    }}>
      <div className="card-body py-2 px-3">
        {isStandalone && routers.length > 0 && (
          <div className="mb-2 pb-2 border-bottom">
            <label className="form-label small fw-bold text-secondary mb-1">Pilih Router</label>
            <select 
              className="form-select form-select-sm shadow-none border-secondary-subtle fw-medium"
              value={selectedRouter || ""}
              onChange={async (e) => {
                const newRouterId = Number(e.target.value);
                setApiSelectedRouter(newRouterId);
                setLoading(true);
                try {
                  const [oltRes, usersRes] = await Promise.allSettled([
                    api.get(`/olt-ports/router/${newRouterId}`),
                    api.get(`/pppoe/${newRouterId}`)
                  ]);
                  const extractData = (res) => {
                    if (res?.status !== 'fulfilled') return [];
                    if (Array.isArray(res.value?.data?.data)) return res.value.data.data;
                    if (Array.isArray(res.value?.data)) return res.value.data;
                    return [];
                  };
                  setApiOltPorts(extractData(oltRes));
                  setApiUsers(extractData(usersRes));
                } finally { setLoading(false); }
              }}
            >
              {routers.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}
        <h6 className="fw-semibold mb-2 small text-muted">Topology Stats</h6>
        {loading ? (
          <div className="text-center py-2"><span className="spinner-border spinner-border-sm text-primary"></span></div>
        ) : (
          <div className="d-flex flex-column gap-1 small">
            <div className="d-flex justify-content-between">
              <span className="text-muted">OLT Ports:</span>
              <strong className="text-dark">{filteredOltPorts.length}</strong>
            </div>
            <div className="d-flex justify-content-between">
              <span className="text-muted">ODC Nodes:</span>
              <strong className="text-dark">{filteredNodes.filter(n => n.type === 'ODC').length}</strong>
            </div>
            <div className="d-flex justify-content-between">
              <span className="text-muted">ODP Nodes:</span>
              <strong className="text-dark">{filteredNodes.filter(n => n.type === 'ODP').length}</strong>
            </div>
            <div className="d-flex justify-content-between">
              <span className="text-muted">Clients:</span>
              <strong className="text-dark">{filteredUsers.filter(u => u.topologyNodeId).length}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render markers for each entity type
  const renderMarkers = () => {
    const markers = [];

    // Router markers
    routers.forEach(router => {
      if (!isValidCoord(router.latitude, router.longitude)) return;
      markers.push(
        <Marker 
          key={`router-${router.id}`} 
          position={[Number(router.latitude), Number(router.longitude)]}
          icon={createCustomIcon(MARKER_CONFIG.router.color, MARKER_CONFIG.router.icon)}
          eventHandlers={{ click: () => handleMarkerClick(router, 'router') }}
        >
          <Popup minWidth={200}>
            <div className="p-1">
              <strong className="d-block text-dark">{router.name}</strong>
              <small className="text-muted d-block">{router.host}</small>
              <span className={`badge ${router.isOnline ? 'bg-success' : 'bg-secondary'} mt-1`}>
                {router.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </Popup>
        </Marker>
      );
    });

    // OLT Port markers
    filteredOltPorts.forEach(port => {
      if (!isValidCoord(port.latitude, port.longitude)) return;
      markers.push(
        <Marker 
          key={`olt-${port.id}`} 
          position={[Number(port.latitude), Number(port.longitude)]}
          icon={createCustomIcon(MARKER_CONFIG.oltPort.color, MARKER_CONFIG.oltPort.icon)}
          eventHandlers={{ click: () => handleMarkerClick(port, 'oltPort') }}
        >
          <Popup minWidth={220}>
            <div className="p-1">
              <strong className="d-block text-dark">{port.name}</strong>
              <small className="text-muted d-block"><i className="bi bi-plug me-1"></i>{port.port}</small>
              <small className="text-muted d-block mt-1">{getRouterName(port.routerId)}</small>
            </div>
          </Popup>
        </Marker>
      );
    });

    // Node markers (ODC/ODP)
    filteredNodes.forEach(node => {
      if (!isValidCoord(node.latitude, node.longitude)) return;
      const config = node.type === 'ODP' ? MARKER_CONFIG.ODP : MARKER_CONFIG.ODC;
      const anyUser = hasAnyUser(node.id);
      const isFaulty = anyUser && !hasOnlineUser(node.id);
      const markerColor = isFaulty ? '#ef4444' : config.color;

      markers.push(
        <Marker 
          key={`node-${node.id}-${markerColor}`} 
          position={[Number(node.latitude), Number(node.longitude)]}
          icon={createCustomIcon(markerColor, config.icon, isFaulty)}
          eventHandlers={{ click: () => handleMarkerClick(node, 'node') }}
        >
          <Popup minWidth={220}>
            <div className="p-1">
              <strong className="d-block text-dark">{node.name}</strong>
              <span className={`badge ${node.type === 'ODP' ? 'bg-warning text-dark' : 'bg-success'} me-1`}>{node.type}</span>
              {isFaulty && <span className="badge bg-danger">⚠️ Kabel Putus / Total Offline</span>}
              {node.description && <small className="text-muted d-block mt-1">{node.description}</small>}
            </div>
          </Popup>
        </Marker>
      );
    });

    // Client markers (only assigned users with location)
    filteredUsers.forEach(user => {
      if (!user.topologyNodeId || !isValidCoord(user.latitude, user.longitude)) return;
      const isOnline = user.isOnline;
      const markerColor = isOnline ? '#10b981' : '#ef4444';
      markers.push(
        <Marker 
          key={`client-${user.id}-${markerColor}`} 
          position={[Number(user.latitude), Number(user.longitude)]}
          icon={createCustomIcon(markerColor, MARKER_CONFIG.client.icon, !isOnline)}
          eventHandlers={{ click: () => handleMarkerClick(user, 'client') }}
        >
          <Popup minWidth={200}>
            <div className="p-1">
              <strong className="d-block text-dark">{user.username}</strong>
              <small className="text-muted d-block"><i className="bi bi-pc-display me-1"></i>{user.remoteAddress || 'No IP'}</small>
              <span className={`badge ${isOnline ? 'bg-success' : 'bg-danger'} mt-1`}>
                {isOnline ? 'Online' : 'Offline / Terputus'}
              </span>
            </div>
          </Popup>
        </Marker>
      );
    });

    return markers;
  };

  // Helper function (should be imported or defined elsewhere in your app)
  const getRouterName = (id) => routers.find(r => r.id === id)?.name || `Router #${id}`;

  return (
    <div className="position-relative rounded-3 overflow-hidden border shadow-sm" style={{ height, background: '#f8f9fa' }}>
      
      {/* Map Container */}
      <MapContainer 
        center={mapCenter} 
        zoom={13} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%', borderRadius: '12px' }}
        zoomControl={true}
        ref={setMapInstance}
      >
        {/* White-themed tile layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        
        {/* Topology connection lines */}
        {connections.map(line => (
          <Polyline 
            key={`${line.id}-${line.color}-${line.dashArray || 'solid'}`}
            positions={line.coordinates}
            color={line.color}
            weight={line.weight}
            opacity={0.85}
            dashArray={line.dashArray}
            smoothFactor={0}
            lineCap="round"
            lineJoin="round"
          >
            {line.label && (
              <Popup>
                <div className="p-1 text-center" style={{ minWidth: '180px' }}>
                  <strong style={{ color: line.color === '#adb5bd' ? '#6c757d' : line.color }}>{line.label}</strong>
                  {line.sublabel && <div className="small text-muted mt-1">{line.sublabel}</div>}
                </div>
              </Popup>
            )}
          </Polyline>
        ))}
        
        {/* Entity markers */}
        {renderMarkers()}
        
        {/* Auto-fit to bounds */}
        <FitMapBounds coordinates={allCoordinates} selectedRouter={selectedRouter} />
      </MapContainer>

      {/* Overlay Components */}
      <StatsOverlay />
      <MapLegend />
      <DetailPanel />

      {/* Map Controls */}
      <div className="position-absolute" style={{ bottom: '20px', left: '20px', zIndex: 1000 }}>
        <button 
          className="btn btn-white border shadow-sm" 
          onClick={() => {
            if (allCoordinates.length > 0 && mapInstance) {
              const valid = allCoordinates.filter(c => c && isValidCoord(c.lat, c.lng));
              if (valid.length > 0) {
                const bounds = L.latLngBounds(valid.map(c => [c.lat, c.lng]));
                mapInstance.fitBounds(bounds.pad(0.1));
              }
            }
          }}
          title="Fit to all markers"
        >
          <i className="bi bi-arrows-fullscreen"></i>
        </button>
      </div>

      {/* No Data State */}
      {allCoordinates.length === 0 && (
        <div className="position-absolute top-50 start-50 translate-middle text-center" style={{ zIndex: 999 }}>
          <div className="card border-0 shadow-sm" style={{ background: 'white', borderRadius: '12px', padding: '24px', minWidth: '280px' }}>
            <i className="bi bi-geo-alt fs-1 text-muted d-block mb-2"></i>
            <h6 className="fw-semibold text-dark mb-1">No Location Data</h6>
            <p className="text-muted small mb-0">Add latitude/longitude to entities to display them on the map.</p>
          </div>
        </div>
      )}
    </div>
  );
}