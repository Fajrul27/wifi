import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  ScaleControl,
  AttributionControl,
} from "react-leaflet";
import { LayersControl } from "react-leaflet";
import api from "../../services/api";
import { socket } from "../../services/socket";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// =========================
// 🎨 INJECTED CSS STYLES
// =========================
const NOC_MAP_STYLES = `
  :root {
    --noc-bg: #0f172a;
    --noc-bg-secondary: #1e293b;
    --noc-bg-tertiary: #334155;
    --noc-text: #f1f5f9;
    --noc-text-muted: #94a3b8;
    --noc-border: #475569;
    --noc-primary: #3b82f6;
    --noc-success: #22c55e;
    --noc-danger: #ef4444;
    --noc-warning: #f59e0b;
    --noc-info: #06b6d4;
  }

  .noc-map-wrapper {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--noc-bg);
    color: var(--noc-text);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  /* Header */
  .noc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1.25rem;
    background: var(--noc-bg-secondary);
    border-bottom: 1px solid var(--noc-border);
    gap: 1rem;
    flex-wrap: wrap;
  }

  .noc-header h4 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    margin: 0;
    font-size: 1.1rem;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .router-select {
    min-width: 200px;
    max-width: 280px;
    background: var(--noc-bg-tertiary);
    border: 1px solid var(--noc-border);
    border-radius: 8px;
    color: var(--noc-text);
    padding: 0.5rem 0.75rem;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .router-select:focus {
    outline: none;
    border-color: var(--noc-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  .theme-toggle, .refresh-btn {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: var(--noc-bg-tertiary);
    border: 1px solid var(--noc-border);
    color: var(--noc-text);
    cursor: pointer;
    transition: all 0.2s;
  }

  .theme-toggle:hover, .refresh-btn:hover {
    background: var(--noc-primary);
    border-color: var(--noc-primary);
  }

  /* Controls Panel */
  .noc-controls {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 1rem;
    padding: 0.75rem 1.25rem;
    background: var(--noc-bg-secondary);
    border-bottom: 1px solid var(--noc-border);
    flex-wrap: wrap;
  }

  @media (max-width: 900px) {
    .noc-controls { grid-template-columns: 1fr; }
  }

  /* Stats Panel */
  .noc-stats-panel {
    background: var(--noc-bg-tertiary);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    border: 1px solid var(--noc-border);
  }

  .stats-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.5rem;
  }

  @media (max-width: 700px) {
    .stats-grid { grid-template-columns: repeat(3, 1fr); }
  }

  .stat-item {
    text-align: center;
    padding: 0.4rem 0.2rem;
    background: rgba(255,255,255,0.05);
    border-radius: 6px;
  }

  .stat-value {
    display: block;
    font-size: 1.1rem;
    font-weight: 700;
    line-height: 1;
  }

  .stat-label {
    font-size: 0.65rem;
    opacity: 0.85;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  /* Filter Bar */
  .noc-filter-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: var(--noc-bg-tertiary);
    padding: 0.5rem 1rem;
    border-radius: 10px;
    border: 1px solid var(--noc-border);
    flex-wrap: wrap;
  }

  .search-box {
    position: relative;
    flex: 1;
    min-width: 180px;
    max-width: 280px;
  }

  .search-box i {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0.6;
    font-size: 0.85rem;
  }

  .search-box input {
    width: 100%;
    padding: 0.45rem 0.75rem 0.45rem 30px;
    background: var(--noc-bg);
    border: 1px solid var(--noc-border);
    border-radius: 6px;
    color: var(--noc-text);
    font-size: 0.85rem;
  }

  .search-box input:focus {
    outline: none;
    border-color: var(--noc-primary);
  }

  .search-box input::placeholder { color: var(--noc-text-muted); }

  .filter-group select {
    min-width: 130px;
    padding: 0.45rem 2rem 0.45rem 0.75rem;
    background: var(--noc-bg);
    border: 1px solid var(--noc-border);
    border-radius: 6px;
    color: var(--noc-text);
    font-size: 0.85rem;
    cursor: pointer;
  }

  .filter-group select:focus {
    outline: none;
    border-color: var(--noc-primary);
  }

  .legend-mini {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    font-size: 0.8rem;
    opacity: 0.9;
  }

  .legend-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 4px;
    vertical-align: middle;
  }

  .legend-dot.online { background: var(--noc-success); box-shadow: 0 0 6px rgba(34,197,94,0.5); }
  .legend-dot.offline { background: var(--noc-danger); opacity: 0.8; }

  /* Map Container */
  .noc-map-container {
    flex: 1;
    position: relative;
    min-height: 0;
  }

  .noc-leaflet-map {
    height: 100%;
    width: 100%;
    border-radius: 0 0 12px 12px;
  }

  /* Custom Markers */
  .noc-marker { background: transparent !important; border: none !important; }

  .marker-content {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    position: relative;
  }

  /* Router Marker */
  .marker-content.router {
    width: 34px;
    height: 34px;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    border: 3px solid #fff;
    border-radius: 10px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.35);
    color: #fff;
    font-size: 15px;
  }

  .marker-content.router .marker-badge {
    position: absolute;
    bottom: -5px;
    right: -5px;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    border: 2px solid #fff;
    font-size: 0;
    line-height: 1;
  }

  .marker-content.router.online .marker-badge {
    background: var(--noc-success);
    box-shadow: 0 0 5px rgba(34,197,94,0.6);
  }

  .marker-content.router.offline .marker-badge {
    background: var(--noc-danger);
  }

  /* User Marker */
  .marker-content.user {
    width: 30px;
    height: 30px;
    background: #fff;
    border: 2.5px solid #333;
    border-radius: 50%;
    box-shadow: 0 3px 10px rgba(0,0,0,0.3);
    color: #333;
    font-size: 13px;
    transition: transform 0.15s;
  }

  .marker-content.user:hover { transform: scale(1.1); }

  .marker-content.user.online {
    border-color: var(--noc-success);
    background: #dcfce7;
  }

  .marker-content.user.offline {
    border-color: var(--noc-danger);
    background: #fee2e2;
    opacity: 0.9;
  }

  /* Cluster Icons */
  .noc-cluster { background: transparent !important; border: none !important; }

  .cluster-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: var(--noc-primary);
    color: #fff;
    font-weight: 700;
    font-size: 14px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.35);
    border: 3px solid #fff;
  }

  .cluster-icon.good { background: var(--noc-success); }
  .cluster-icon.warn { background: var(--noc-warning); color: #1a1a2e; }
  .cluster-icon.bad { background: var(--noc-danger); }

  .cluster-icon small {
    font-size: 9px;
    opacity: 0.95;
    font-weight: 500;
  }

  /* Popups */
  .noc-popup {
    min-width: 260px !important;
    max-width: 320px !important;
  }

  .noc-popup .leaflet-popup-content-wrapper {
    background: var(--noc-bg-secondary) !important;
    color: var(--noc-text) !important;
    border-radius: 12px !important;
    border: 1px solid var(--noc-border) !important;
    box-shadow: 0 8px 25px rgba(0,0,0,0.4) !important;
  }

  .noc-popup .leaflet-popup-tip {
    background: var(--noc-bg-secondary) !important;
    border: 1px solid var(--noc-border) !important;
  }

  .popup-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 0.75rem 0.5rem;
    border-bottom: 1px solid var(--noc-border);
    margin-bottom: 0.5rem;
  }

  .popup-header strong {
    flex: 1;
    font-size: 1rem;
    word-break: break-word;
  }

  .popup-header .status-badge {
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    border-radius: 20px;
    background: rgba(34,197,94,0.15);
    color: var(--noc-success);
  }

  .popup-header .status-badge.offline {
    background: rgba(239,68,68,0.15);
    color: var(--noc-danger);
  }

  .popup-body {
    padding: 0 0.75rem 0.75rem;
    font-size: 0.9rem;
  }

  .popup-body .info-row {
    display: flex;
    justify-content: space-between;
    padding: 0.25rem 0;
    gap: 1rem;
  }

  .popup-body .info-row label {
    color: var(--noc-text-muted);
    font-size: 0.8rem;
    flex-shrink: 0;
  }

  .popup-body .info-row span {
    text-align: right;
    word-break: break-all;
  }

  .popup-body .info-row .mono {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 0.85rem;
  }

  .popup-body hr {
    border-color: var(--noc-border);
    margin: 0.5rem 0;
    opacity: 0.5;
  }

  .traffic-stats {
    display: flex;
    justify-content: space-around;
    padding: 0.5rem 0;
  }

  .traffic-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .traffic-item i { font-size: 0.85rem; }

  .popup-footer {
    padding: 0.4rem 0.75rem 0.75rem;
    text-align: right;
    font-size: 0.75rem;
    color: var(--noc-text-muted);
    border-top: 1px solid var(--noc-border);
    margin-top: 0.25rem;
  }

  /* Legend */
  .noc-legend {
    position: absolute;
    bottom: 20px;
    left: 20px;
    background: var(--noc-bg-secondary);
    border: 1px solid var(--noc-border);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    z-index: 1000;
    min-width: 180px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.25);
  }

  .legend-title {
    font-weight: 600;
    font-size: 0.85rem;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding-bottom: 0.4rem;
    border-bottom: 1px solid var(--noc-border);
  }

  .legend-items {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.8rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .legend-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    font-size: 10px;
  }

  .legend-icon.router {
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    border: 2px solid #fff;
  }

  .legend-icon.user {
    border-radius: 50%;
    border: 2px solid #333;
    background: #fff;
  }

  .legend-icon.user.online { border-color: var(--noc-success); background: #dcfce7; }
  .legend-icon.user.offline { border-color: var(--noc-danger); background: #fee2e2; opacity: 0.85; }

  .legend-line {
    width: 24px;
    height: 3px;
    border-radius: 2px;
  }

  .legend-line.online { background: var(--noc-success); }
  .legend-line.offline {
    background: var(--noc-danger);
    background-image: repeating-linear-gradient(45deg, var(--noc-danger), var(--noc-danger) 4px, transparent 4px, transparent 8px);
  }

  /* Loading & Error States */
  .noc-loading, .noc-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: var(--noc-bg);
    color: var(--noc-text);
    text-align: center;
    padding: 2rem;
  }

  .noc-loading .spinner-border {
    width: 3rem;
    height: 3rem;
    border-width: 0.25rem;
  }

  .noc-error {
    background: linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.05));
  }

  .noc-error i {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    color: var(--noc-danger);
  }

  /* Leaflet overrides for dark theme */
  .leaflet-bar a,
  .leaflet-bar a:hover {
    background: var(--noc-bg-secondary) !important;
    color: var(--noc-text) !important;
    border-color: var(--noc-border) !important;
  }

  .leaflet-control-layers,
  .leaflet-control-layers-expanded {
    background: var(--noc-bg-secondary) !important;
    color: var(--noc-text) !important;
    border: 1px solid var(--noc-border) !important;
    border-radius: 8px !important;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3) !important;
  }

  .leaflet-control-layers-list label {
    color: var(--noc-text) !important;
    padding: 0.35rem 0.5rem;
    display: flex;
    align-items: center;
  }

  .leaflet-control-layers-selector {
    accent-color: var(--noc-primary) !important;
    margin-right: 6px !important;
    cursor: pointer;
  }

  .leaflet-control-layers-separator {
    border-color: var(--noc-border) !important;
  }

  .leaflet-control-attribution {
    background: rgba(15,23,42,0.85) !important;
    color: var(--noc-text-muted) !important;
    border-radius: 4px 0 0 0 !important;
    font-size: 0.7rem;
  }

  .leaflet-control-attribution a {
    color: var(--noc-primary) !important;
  }

  .leaflet-control-scale-line {
    background: rgba(15,23,42,0.85) !important;
    color: var(--noc-text) !important;
    border-color: var(--noc-border) !important;
    border-radius: 3px;
    font-size: 0.7rem;
  }
`;

// =========================
// 🎨 STYLE INJECTOR COMPONENT
// =========================
function StyleInjector() {
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "noc-map-styles";
    style.textContent = NOC_MAP_STYLES;
    document.head.appendChild(style);
    return () => {
      const existing = document.getElementById("noc-map-styles");
      if (existing) existing.remove();
    };
  }, []);
  return null;
}

// =========================
// 🎯 CUSTOM ICONS
// =========================
const routerIconCache = {};
const createRouterIcon = (isOnline = true) => {
  if (routerIconCache[isOnline]) return routerIconCache[isOnline];
  const icon = new L.DivIcon({
    className: "noc-marker router-marker",
    html: `<div class="marker-content router ${isOnline ? "online" : "offline"}">
            <i class="fas fa-server"></i>
            <span class="marker-badge">${isOnline ? "●" : "○"}</span>
          </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
  routerIconCache[isOnline] = icon;
  return icon;
};

const userIconCache = {};
const createUserIcon = (isOnline) => {
  if (userIconCache[isOnline]) return userIconCache[isOnline];
  const icon = new L.DivIcon({
    className: "noc-marker user-marker",
    html: `<div class="marker-content user ${isOnline ? "online" : "offline"}">
            <i class="fas fa-user"></i>
          </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
  userIconCache[isOnline] = icon;
  return icon;
};

// =========================
// 🎯 MAP AUTO-FOCUS
// =========================
function MapAutoFocus({ target, zoom = 14 }) {
  const map = useMap();
  const prevTargetIdRef = useRef(null);
  useEffect(() => {
    if (target?.latitude && target?.longitude) {
      const targetKey = target.id || target.username || target.name;
      if (prevTargetIdRef.current !== targetKey) {
        map.flyTo([target.latitude, target.longitude], zoom, {
          duration: 1.2,
          animate: true,
        });
        prevTargetIdRef.current = targetKey;
      }
    }
  }, [target, zoom, map]);
  return null;
}

// Component to auto-fit map bounds to markers
function FitMapBounds({ coordinates, selectedRouter }) {
  const map = useMap();
  const prevRouterRef = useRef(undefined);
  const userInteractedRef = useRef(false);
  
  // Reset interaction flag when selectedRouter changes
  useEffect(() => {
    if (prevRouterRef.current !== selectedRouter) {
      prevRouterRef.current = selectedRouter;
      userInteractedRef.current = false;
    }
  }, [selectedRouter]);

  // Listen for user manual zoom/drag to disable auto-fitting
  useEffect(() => {
    const container = map.getContainer();
    const handleInteraction = () => {
      userInteractedRef.current = true;
    };
    
    container.addEventListener("mousedown", handleInteraction);
    container.addEventListener("touchstart", handleInteraction, { passive: true });
    container.addEventListener("wheel", handleInteraction, { passive: true });
    
    return () => {
      container.removeEventListener("mousedown", handleInteraction);
      container.removeEventListener("touchstart", handleInteraction);
      container.removeEventListener("wheel", handleInteraction);
    };
  }, [map]);

  const hasFlownRef = useRef(false);

  useEffect(() => {
    // If the user has manually panned or zoomed, do not auto-fit anymore
    if (userInteractedRef.current) return;

    if (coordinates && coordinates.length > 0) {
      const validCoords = coordinates.filter(
        c => c && c.lat && c.lng && !isNaN(c.lat) && !isNaN(c.lng) && c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180
      );
      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords.map(c => [c.lat, c.lng]));
        const delay = hasFlownRef.current ? 0 : 600;
        hasFlownRef.current = true;
        const timer = setTimeout(() => {
          map.fitBounds(bounds.pad(0.15), {
            animate: true,
            duration: 1.5,
            maxZoom: 16,
          });
        }, delay);
        return () => clearTimeout(timer);
      }
    }
  }, [coordinates, map]);
  
  return null;
}

// Custom Leaflet SVG renderer with optimized padding to prevent lines clipping during pan
const customRenderer = L.svg({ padding: 1.5 });

// Optimized connection lines to prevent re-rendering and lag
const MemoizedUserPolyline = React.memo(({ routerLat, routerLng, userLat, userLng, isOnline }) => {
  return (
    <Polyline
      positions={[
        [routerLat, routerLng],
        [userLat, userLng],
      ]}
      noClip={true}
      pathOptions={{
        color: isOnline ? "#22c55e" : "#ef4444",
        weight: isOnline ? 2 : 1,
        opacity: isOnline ? 0.7 : 0.4,
        dashArray: isOnline ? null : "5,8",
        lineCap: "round",
        noClip: true
      }}
    />
  );
}, (prev, next) => {
  return prev.routerLat === next.routerLat &&
         prev.routerLng === next.routerLng &&
         prev.userLat === next.userLat &&
         prev.userLng === next.userLng &&
         prev.isOnline === next.isOnline;
});

// =========================
// 📊 STATS PANEL
// =========================
function StatsPanel({ users, routers, selectedRouter }) {
  const stats = useMemo(() => {
    const valid = users.filter((u) => u.latitude && u.longitude);
    return {
      total: valid.length,
      online: valid.filter((u) => u.isOnline).length,
      offline: valid.filter((u) => !u.isOnline).length,
      avgRx: valid.length ? valid.reduce((a, b) => a + (b.rxMbps || 0), 0) / valid.length : 0,
      avgTx: valid.length ? valid.reduce((a, b) => a + (b.txMbps || 0), 0) / valid.length : 0,
    };
  }, [users]);

  return (
    <div className="noc-stats-panel">
      <div className="stats-header">
        <span>📊 Network Status</span>
        <span style={{ fontSize: "0.8rem", opacity: 0.85 }}>
          {routers.find((r) => r.id === selectedRouter)?.name || "Select Router"}
        </span>
      </div>
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-value" style={{ color: "var(--noc-success)" }}>{stats.online}</span>
          <span className="stat-label">Online</span>
        </div>
        <div className="stat-item">
          <span className="stat-value" style={{ color: "var(--noc-danger)" }}>{stats.offline}</span>
          <span className="stat-label">Offline</span>
        </div>
        <div className="stat-item">
          <span className="stat-value" style={{ color: "var(--noc-info)" }}>{stats.total}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-item">
          <span className="stat-value" style={{ color: "var(--noc-warning)" }}>{stats.avgRx.toFixed(1)}</span>
          <span className="stat-label">Avg ↓</span>
        </div>
        <div className="stat-item">
          <span className="stat-value" style={{ color: "var(--noc-primary)" }}>{stats.avgTx.toFixed(1)}</span>
          <span className="stat-label">Avg ↑</span>
        </div>
      </div>
    </div>
  );
}

// =========================
// 🔍 FILTER BAR
// =========================
function FilterBar({ searchQuery, setSearchQuery, statusFilter, setStatusFilter }) {
  return (
    <div className="noc-filter-bar">
      <div className="search-box">
        <i>🔍</i>
        <input
          type="text"
          placeholder="Search username, IP, profile..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <div className="filter-group">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="online">🟢 Online Only</option>
          <option value="offline">🔴 Offline Only</option>
        </select>
      </div>
      <div className="legend-mini">
        <span><span className="legend-dot online"></span>Online</span>
        <span><span className="legend-dot offline"></span>Offline</span>
      </div>
    </div>
  );
}

// =========================
// 🗺️ MAIN COMPONENT
// =========================
export default function NocPppoeMap() {
  const [routers, setRouters] = useState([]);
  const [selectedRouter, setSelectedRouter] = useState(null);
  const [router, setRouter] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapTheme, setMapTheme] = useState("osm");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Load routers
  const loadRouters = async () => {
    try {
      setLoading(true);
      const res = await api.get("/routers");
      setRouters(res.data);
      if (!selectedRouter && res.data.length > 0) {
        setSelectedRouter(res.data[0].id);
      }
    } catch (err) {
      setError("Failed to load routers");
      console.error("Router error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load router data
  const loadRouterData = async (routerId) => {
    if (!routerId) return;
    try {
      const [routerRes, userRes] = await Promise.all([
        api.get(`/routers/${routerId}`),
        api.get(`/pppoe/${routerId}`),
      ]);
      setRouter(routerRes.data);
      setUsers(userRes.data.data || userRes.data || []);
      setError(null);
    } catch (err) {
      setError("Failed to load router data");
      console.error("Load error:", err);
    }
  };

  // Initial load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadRouters(); }, []);

  // Load when router changes
  useEffect(() => {
    if (selectedRouter) loadRouterData(selectedRouter);
  }, [selectedRouter]);

  // Socket realtime
  useEffect(() => {
    const handleUpdate = (msg) => {
      if (msg.routerId !== Number(selectedRouter)) return;
      setUsers((prev) => {
        const idx = prev.findIndex((u) => u.username === msg.data.username);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = msg.data;
          return updated;
        }
        return [...prev, msg.data];
      });
    };
    socket.on("pppoe", handleUpdate);
    return () => socket.off("pppoe", handleUpdate);
  }, [selectedRouter]);

  // Filter users
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => u.latitude && u.longitude)
      .filter((u) => {
        if (statusFilter === "online" && !u.isOnline) return false;
        if (statusFilter === "offline" && u.isOnline) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            u.username?.toLowerCase().includes(q) ||
            u.remoteAddress?.toLowerCase().includes(q) ||
            u.profile?.toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [users, statusFilter, searchQuery]);

  // Collect coordinates for fit bounds
  const allCoordinates = useMemo(() => {
    const coords = [];
    if (router?.latitude && router?.longitude) {
      coords.push({ lat: Number(router.latitude), lng: Number(router.longitude) });
    }
    filteredUsers.forEach(u => {
      if (u.latitude && u.longitude) {
        coords.push({ lat: Number(u.latitude), lng: Number(u.longitude) });
      }
    });
    return coords;
  }, [router, filteredUsers]);

  // Map layers config
  const tileLayers = {
    osm: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>',
      name: "Standard",
    },
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri",
      name: "Satellite",
    },
    dark: {
      url: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
      attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>',
      name: "Dark Mode",
    },
  };

  // Loading state
  if (loading && !routers.length) {
    return (
      <>
        <StyleInjector />
        <div className="noc-loading">
          <div className="spinner-border" style={{ borderColor: "var(--noc-primary)", borderRightColor: "transparent" }} role="status" />
          <p style={{ marginTop: "1rem", color: "var(--noc-text-muted)" }}>Initializing NOC Map...</p>
        </div>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <StyleInjector />
        <div className="noc-error">
          <span style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</span>
          <p style={{ fontWeight: 500 }}>{error}</p>
          <button
            onClick={loadRouters}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1.25rem",
              background: "var(--noc-primary)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            🔄 Retry
          </button>
        </div>
      </>
    );
  }


  return (
    <>
      <StyleInjector />
      <div className="noc-map-wrapper">
        {/* Header */}
        <div className="noc-header">
          <h4>🗺️ PPPoE Network Map</h4>
          <div className="header-actions">
            <select
              className="router-select"
              value={selectedRouter || ""}
              onChange={(e) => setSelectedRouter(Number(e.target.value))}
            >
              {routers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} • {r.host}
                </option>
              ))}
            </select>
            <button
              className="refresh-btn"
              onClick={() => selectedRouter && loadRouterData(selectedRouter)}
              title="Refresh Data"
            >
              🔄
            </button>
            <button
              className="theme-toggle"
              onClick={() => setMapTheme((p) => (p === "osm" ? "satellite" : p === "satellite" ? "dark" : "osm"))}
              title="Toggle Map Theme"
            >
              {mapTheme === "dark" ? "☀️" : mapTheme === "satellite" ? "🌙" : "🛰️"}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="noc-controls">
          <StatsPanel users={users} routers={routers} selectedRouter={selectedRouter} />
          <FilterBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />
        </div>

        {/* Map */}
        <div className="noc-map-container">
          <MapContainer
            center={[-7.1506, 110.1403]}
            zoom={8}
            className="noc-leaflet-map"
            preferCanvas={false}
            renderer={customRenderer}
          >
            <MapAutoFocus target={router} />
            <FitMapBounds coordinates={allCoordinates} selectedRouter={selectedRouter} />
            <ScaleControl position="bottomleft" metric />
            <AttributionControl prefix="" position="bottomright" />

            {/* Base Layers with dynamic opacity to prevent flash */}
            <TileLayer
              key="osm-tile"
              attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              opacity={mapTheme === "osm" ? 1 : 0}
            />
            <TileLayer
              key="satellite-tile"
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              opacity={mapTheme === "satellite" ? 1 : 0}
            />
            <TileLayer
              key="dark-tile"
              attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>'
              url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
              opacity={mapTheme === "dark" ? 1 : 0}
            />

            {/* Layer Control */}
            <LayersControl position="topright">
              {Object.entries(tileLayers).map(([key, layer]) => (
                <LayersControl.BaseLayer
                  key={key}
                  name={layer.name}
                  checked={mapTheme === key}
                >
                  <TileLayer attribution={layer.attribution} url={layer.url} />
                </LayersControl.BaseLayer>
              ))}
            </LayersControl>

            {/* Router Marker */}
            {router?.latitude && router?.longitude && (
              <Marker
                position={[router.latitude, router.longitude]}
                icon={createRouterIcon(router.isOnline !== false)}
                zIndexOffset={1000}
              >
                <Popup className="noc-popup" autoPan={false}>
                  <div className="popup-header">
                    <strong>🖥️ {router.name}</strong>
                    <span className={`status-badge ${router.isOnline !== false ? "" : "offline"}`}>
                      {router.isOnline !== false ? "🟢 Online" : "🔴 Offline"}
                    </span>
                  </div>
                  <div className="popup-body">
                    <div className="info-row">
                      <label>Host:</label>
                      <span className="mono">{router.host}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Users */}
            {filteredUsers.map((u) => (
              <Marker
                key={u.id || u.username}
                position={[u.latitude, u.longitude]}
                icon={createUserIcon(u.isOnline)}
                options={{ userData: u }}
              >
                <Popup className="noc-popup" minWidth={280} autoPan={false}>
                  <div className="popup-header">
                    <strong>👤 {u.username}</strong>
                    <span className={`status-badge ${u.isOnline ? "" : "offline"}`}>
                      {u.isOnline ? "🟢 Online" : "🔴 Offline"}
                    </span>
                  </div>
                  <div className="popup-body">
                    <div className="info-row">
                      <label>Profile:</label>
                      <span>{u.profile || "-"}</span>
                    </div>
                    <div className="info-row">
                      <label>Client IP:</label>
                      <span className="mono">{u.remoteAddress || "No session"}</span>
                    </div>
                    {u.localAddress && (
                      <div className="info-row">
                        <label>Router IP:</label>
                        <span className="mono">{u.localAddress}</span>
                      </div>
                    )}
                    {u.uptime && (
                      <div className="info-row">
                        <label>Uptime:</label>
                        <span>{u.uptime}</span>
                      </div>
                    )}
                    <hr />
                    <div className="traffic-stats">
                      <div className="traffic-item">
                        <i style={{ color: "var(--noc-success)" }}>↓</i>
                        <span>{(u.rxMbps || 0).toFixed(2)} Mbps</span>
                      </div>
                      <div className="traffic-item">
                        <i style={{ color: "var(--noc-primary)" }}>↑</i>
                        <span>{(u.txMbps || 0).toFixed(2)} Mbps</span>
                      </div>
                    </div>
                  </div>
                  <div className="popup-footer">
                    Updated: {new Date().toLocaleTimeString()}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Connection Lines */}
            {router?.latitude && router?.longitude && filteredUsers.map((u) => (
              <MemoizedUserPolyline
                key={`line-${u.id || u.username}-${u.isOnline ? 'on' : 'off'}`}
                routerLat={router.latitude}
                routerLng={router.longitude}
                userLat={u.latitude}
                userLng={u.longitude}
                isOnline={u.isOnline}
              />
            ))}
          </MapContainer>

          {/* Legend */}
          <div className="noc-legend">
            <div className="legend-title">ℹ️ Legend</div>
            <div className="legend-items">
              <div className="legend-item">
                <span className="legend-icon router"></span>
                <span>Router</span>
              </div>
              <div className="legend-item">
                <span className="legend-icon user online"></span>
                <span>User Online</span>
              </div>
              <div className="legend-item">
                <span className="legend-icon user offline"></span>
                <span>User Offline</span>
              </div>
              <div className="legend-item">
                <span className="legend-line online"></span>
                <span>Active</span>
              </div>
              <div className="legend-item">
                <span className="legend-line offline"></span>
                <span>Inactive</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}