import React, { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "../admin/AdminDashboard.css";
import L from "leaflet";
import api from "../../services/api";
import { createCustomIcon, MARKER_CONFIG, isValidCoord, buildCableCoordinates, getMapEntityStatus } from "../admin/utils/mapUtils";
import { FitMapBounds, MemoizedPolyline, MemoizedMarker } from "../admin/components/DashboardMapComponents";
import DashboardKpiCards from "../admin/components/DashboardKpiCards";
import DashboardBandwidthChart from "../admin/components/DashboardBandwidthChart";
import DashboardSystemLogs from "../admin/components/DashboardSystemLogs";
import NodePortDetailModal from "../admin/components/NodePortDetailModal";
import { useGlobalRealtime } from "../../context/GlobalRealtimeContext";
import {
  usePppoeUserMonitor,
  StatusBadge,
  ConnectionBadge,
  formatTraffic,
} from "../router/components/PppoeUserMonitor";

const canvasRenderer = L.canvas({ padding: 1.0 });

// Helper to listen to map viewport changes (bounds & zoom)
function MapViewportListener({ onBoundsChange, onZoomChange }) {
  const map = useMap();
  useEffect(() => {
    const handleMapChange = () => {
      onBoundsChange(map.getBounds().pad(1.0));
      onZoomChange(map.getZoom());
    };
    handleMapChange();
    map.on("moveend", handleMapChange);
    map.on("zoomend", handleMapChange);
    return () => {
      map.off("moveend", handleMapChange);
      map.off("zoomend", handleMapChange);
    };
  }, [map, onBoundsChange, onZoomChange]);
  return null;
}

const groupIconCache = {};
const getGroupIcon = (count, isFaulty) => {
  const cacheKey = `${count}-${isFaulty}`;
  if (groupIconCache[cacheKey]) return groupIconCache[cacheKey];
  
  const iconHtml = `
      <div style="background-color: ${isFaulty ? '#ef4444' : '#0ea5e9'}; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-weight: bold; font-size: 11px;">
          ${count}
      </div>
  `;
  const icon = L.divIcon({ html: iconHtml, className: "", iconSize: [24, 24], iconAnchor: [12, 12] });
  groupIconCache[cacheKey] = icon;
  return icon;
};

const clientGroupIconCache = {};
const getClientGroupIcon = (count, anyOnline) => {
  const cacheKey = `${count}-${anyOnline}`;
  if (clientGroupIconCache[cacheKey]) return clientGroupIconCache[cacheKey];
  
  const markerColor = anyOnline ? '#10b981' : '#ef4444';
  const iconHtml = `
      <div style="background-color: ${markerColor}; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.4); font-weight: bold; font-size: 11px;">
          ${count}
      </div>
  `;
  const icon = L.divIcon({ html: iconHtml, className: "", iconSize: [28, 28], iconAnchor: [14, 14] });
  clientGroupIconCache[cacheKey] = icon;
  return icon;
};

// Reusable Action Button
const ActionButton = ({ icon, title, variant, onClick, disabled, loading, size = "sm" }) => (
  <button
    className={`btn btn-outline-${variant} btn-${size} position-relative`}
    onClick={onClick}
    disabled={disabled || loading}
    title={title}
    style={{ 
      padding: "4px 8px",
      minWidth: "32px",
      transition: "all 0.2s ease",
      transform: "scale(1)",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
  >
    {loading ? (
      <span className="spinner-border spinner-border-sm" role="status" style={{ width: "12px", height: "12px" }}></span>
    ) : (
      <i className={`bi bi-${icon}`}></i>
    )}
  </button>
);

// Pagination config
const ITEMS_PER_PAGE_OPTIONS = [25, 50, 100, 250];
const DEFAULT_ITEMS_PER_PAGE = 50;

// Pagination Controls Component
const PaginationControls = ({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange, onItemsPerPageChange }) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const generatePageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 py-2 px-3 bg-light rounded-bottom">
      <div className="small text-muted">
        Menampilkan {startItem}-{endItem} dari {totalItems} data
      </div>
      
      <div className="d-flex align-items-center gap-2">
        <select 
          className="form-select form-select-sm" 
          style={{ width: "auto" }}
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
        >
          {ITEMS_PER_PAGE_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt} / halaman</option>
          ))}
        </select>

        <nav aria-label="Page navigation">
          <ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => onPageChange(1)} disabled={currentPage === 1}>
                <i className="bi bi-chevron-double-left"></i>
              </button>
            </li>
            <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
                <i className="bi bi-chevron-left"></i>
              </button>
            </li>
            
            {generatePageNumbers().map((page, idx) => (
              page === '...' ? (
                <li key={`ellipsis-${idx}`} className="page-item disabled">
                  <span className="page-link">...</span>
                </li>
              ) : (
                <li key={page} className={`page-item ${currentPage === page ? "active" : ""}`}>
                  <button className="page-link" onClick={() => onPageChange(page)}>{page}</button>
                </li>
              )
            ))}
            
            <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                <i className="bi bi-chevron-right"></i>
              </button>
            </li>
            <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages}>
                <i className="bi bi-chevron-double-right"></i>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
};

export default function TechnicianDashboard({
  routers: propRouters = [],
  oltPorts: propOltPorts = [],
  nodes: propNodes = [],
  pppoeUsers: propUsers = [],
  selectedRouter: propSelectedRouter = null,
  onNodeClick = null,
  onOltPortClick = null
}) {
  const [mapCenter, setMapCenter] = useState([-7.1506, 110.1403]);
  const [mapInstance, setMapInstance] = useState(null);

  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.classList.contains("dark-mode")
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains("dark-mode"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    });
    return () => observer.disconnect();
  }, []);

  const {
    routers: ctxRouters,
    nodes: ctxNodes,
    oltPorts: ctxOltPorts,
    pppoeUsers: ctxUsers,
    eventLogs: ctxEventLogs,
    selectedRouter: ctxSelectedRouter,
    setSelectedRouter: ctxSetSelectedRouter,
    isRouterLocked,
    setIsRouterLocked,
    routersTrafficRef: ctxRoutersTrafficRef,
    monitorSocketConnected,
    isRouterConnected,
    metrics
  } = useGlobalRealtime();

  const [mapType, setMapType] = useState(() => {
    try { return sessionStorage.getItem('dashboard_map_type') || 'vector'; }
    catch(e) { return 'vector'; }
  });
  
  useEffect(() => {
    try { sessionStorage.setItem('dashboard_map_type', mapType); } catch(e){}
  }, [mapType]);

  const [mapZoom, setMapZoom] = useState(8);
  const [visibleBounds, setVisibleBounds] = useState(null);
  const [activePopup, setActivePopup] = useState(null);
  const [portDetailNode, setPortDetailNode] = useState(null);

  const [showClients, setShowClients] = useState(() => {
    try { const v = sessionStorage.getItem('dashboard_show_clients'); return v !== null ? v === 'true' : true; } catch(e) { return true; }
  });
  const [showNodes, setShowNodes] = useState(() => {
    try { const v = sessionStorage.getItem('dashboard_show_nodes'); return v !== null ? v === 'true' : true; } catch(e) { return true; }
  });
  const [showLines, setShowLines] = useState(() => {
    try { const v = sessionStorage.getItem('dashboard_show_lines'); return v !== null ? v === 'true' : true; } catch(e) { return true; }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('dashboard_show_clients', showClients);
      sessionStorage.setItem('dashboard_show_nodes', showNodes);
      sessionStorage.setItem('dashboard_show_lines', showLines);
    } catch(e) {}
  }, [showClients, showNodes, showLines]);

  const [searchTerm, setSearchTerm] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [visibleSearchCount, setVisibleSearchCount] = useState(7);

  useEffect(() => {
    setVisibleSearchCount(7);
  }, [searchTerm]);

  const [isDeferredReady, setIsDeferredReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsDeferredReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const localRoutersTrafficRef = useRef({});

  const isStandalone = propRouters.length === 0;

  const routers = isStandalone ? ctxRouters : propRouters;
  const oltPorts = isStandalone ? ctxOltPorts : propOltPorts;
  const nodes = isStandalone ? ctxNodes : propNodes;
  const pppoeUsers = isStandalone ? ctxUsers : propUsers;
  const selectedRouter = isStandalone ? ctxSelectedRouter : propSelectedRouter;
  const routersTrafficRef = isStandalone ? ctxRoutersTrafficRef : localRoutersTrafficRef;

  const [, setApiSelectedRouter_local] = useState(null);
  const setApiSelectedRouter = isStandalone ? ctxSetSelectedRouter : setApiSelectedRouter_local;
  const eventLogs = isStandalone ? ctxEventLogs : [];

  const [lightbox, setLightbox] = useState({ isOpen: false, index: 0, images: [] });
  const [selectedCable, setSelectedCable] = useState(null);
  const [activeGroupDetailNode, setActiveGroupDetailNode] = useState(null);
  const [activeGroupDetailClient, setActiveGroupDetailClient] = useState(null);
  const [customAlert, setCustomAlert] = useState({ show: false, title: "", message: "", type: "info" });

  const showAlert = useCallback((message, title = "Notifikasi", type = "info") => {
    setCustomAlert({ show: true, title, message, type });
  }, []);

  useEffect(() => {
    if (!lightbox.isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setLightbox(prev => ({ ...prev, isOpen: false }));
      } else if (e.key === "ArrowLeft") {
        setLightbox(prev => ({
          ...prev,
          index: (prev.index - 1 + prev.images.length) % prev.images.length
        }));
      } else if (e.key === "ArrowRight") {
        setLightbox(prev => ({
          ...prev,
          index: (prev.index + 1) % prev.images.length
        }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightbox.isOpen]);

  const filteredOltPorts = useMemo(() => {
    return selectedRouter 
      ? oltPorts.filter(p => Number(p.routerId) === Number(selectedRouter))
      : oltPorts;
  }, [oltPorts, selectedRouter]);

  const filteredNodes = useMemo(() => {
    if (!selectedRouter) return nodes;
    const isNodeOnRouter = (node) => {
      if (node.oltPortId) {
        const port = oltPorts.find(p => Number(p.id) === Number(node.oltPortId));
        return Number(port?.routerId) === Number(selectedRouter);
      }
      if (node.parentNodeId) {
        const parent = nodes.find(n => n.type === "ODC" && Number(n.id) === Number(node.parentNodeId));
        return parent ? isNodeOnRouter(parent) : false;
      }
      return false;
    };
    return nodes.filter(isNodeOnRouter);
  }, [nodes, oltPorts, selectedRouter]);

  const filteredUsers = useMemo(() => {
    return selectedRouter
      ? pppoeUsers.filter(u => !u.routerId || Number(u.routerId) === Number(selectedRouter))
      : pppoeUsers;
  }, [pppoeUsers, selectedRouter]);

  const usersInViewCount = useMemo(() => {
    if (!visibleBounds) return filteredUsers.length;
    return filteredUsers.filter((u) => {
      const lat = Number(u.latitude);
      const lng = Number(u.longitude);
      return !isNaN(lat) && !isNaN(lng) && visibleBounds.contains([lat, lng]);
    }).length;
  }, [filteredUsers, visibleBounds]);

  const shouldShowClients = showClients && (mapZoom >= 18 || usersInViewCount < 50);

  const getClusterThreshold = (zoom) => {
    if (zoom >= 19) return 0.000005;
    if (zoom === 18) return 0.00003;
    if (zoom === 17) return 0.00008;
    if (zoom === 16) return 0.0002;
    if (zoom === 15) return 0.0005;
    if (zoom === 14) return 0.001;
    if (zoom === 13) return 0.002;
    if (zoom === 12) return 0.005;
    return 0.01;
  };

  const groupedNodes = useMemo(() => {
    const groupMap = new Map();
    const threshold = getClusterThreshold(mapZoom);

    filteredNodes.forEach(node => {
        if (!isValidCoord(node.latitude, node.longitude)) return;
        
        const latKey = Math.round(node.latitude / threshold);
        const lngKey = Math.round(node.longitude / threshold);
        const key = `${latKey}_${lngKey}`;
        
        if (!groupMap.has(key)) {
            groupMap.set(key, []);
        }
        groupMap.get(key).push(node);
    });

    return Array.from(groupMap.values());
  }, [filteredNodes, mapZoom]);

  const groupedUsers = useMemo(() => {
    const groupMap = new Map();
    const threshold = getClusterThreshold(mapZoom);

    filteredUsers.forEach(user => {
        if (!user.topologyNodeId || !isValidCoord(user.latitude, user.longitude)) return;
        
        const latKey = Math.round(user.latitude / threshold);
        const lngKey = Math.round(user.longitude / threshold);
        const key = `${latKey}_${lngKey}`;
        
        if (!groupMap.has(key)) {
            groupMap.set(key, []);
        }
        groupMap.get(key).push(user);
    });

    return Array.from(groupMap.values());
  }, [filteredUsers, mapZoom]);

  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term || term.length < 2) return [];
    const results = [];
    filteredUsers.forEach(u => {
      if (u.username?.toLowerCase().includes(term))
        results.push({ ...u, _type: 'client', _label: u.username, _icon: 'bi-pc-display-horizontal', _color: u.isOnline ? '#10b981' : '#ef4444' });
    });
    filteredNodes.forEach(n => {
      if (n.name?.toLowerCase().includes(term))
        results.push({ ...n, _type: 'node', _label: n.name, _icon: n.type === 'ODP' ? 'bi-modem-fill' : 'bi-hdd-network-fill', _color: n.type === 'ODP' ? '#f59e0b' : '#8b5cf6' });
    });
    routers.forEach(r => {
      if (r.name?.toLowerCase().includes(term))
        results.push({ ...r, _type: 'router', _label: r.name, _icon: 'bi-router-fill', _color: '#0ea5e9' });
    });
    return results;
  }, [searchTerm, filteredUsers, filteredNodes, routers]);

  const allCoordinates = useMemo(() => {
    if (!isDeferredReady) return [];
    const coords = [];
    routers.forEach(r => {
      if (selectedRouter && Number(r.id) !== Number(selectedRouter)) return;
      if (isValidCoord(r.latitude, r.longitude)) coords.push({ lat: Number(r.latitude), lng: Number(r.longitude) });
    });
    filteredOltPorts.forEach(p => { if (isValidCoord(p.latitude, p.longitude)) coords.push({ lat: Number(p.latitude), lng: Number(p.longitude) }); });
    filteredNodes.forEach(n => { if (isValidCoord(n.latitude, n.longitude)) coords.push({ lat: Number(n.latitude), lng: Number(n.longitude) }); });
    filteredUsers.forEach(u => { if (isValidCoord(u.latitude, u.longitude)) coords.push({ lat: Number(u.latitude), lng: Number(u.longitude) }); });
    return coords;
  }, [routers, filteredOltPorts, filteredNodes, filteredUsers, isDeferredReady, selectedRouter]);

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

  const userStatusMap = useMemo(() => {
    const hasAnyMap = new Map();
    const hasOnlineMap = new Map();

    // Group users by topologyNodeId for O(1) lookup
    const usersByNode = new Map();
    filteredUsers.forEach(u => {
      if (u.topologyNodeId) {
        if (!usersByNode.has(u.topologyNodeId)) {
          usersByNode.set(u.topologyNodeId, []);
        }
        usersByNode.get(u.topologyNodeId).push(u);
      }
    });

    // Group children nodes by parentNodeId for O(1) lookup
    const childrenByNode = new Map();
    filteredNodes.forEach(n => {
      const parentId = n.incomingLinks?.[0]?.fromNodeId || n.parentNodeId;
      if (parentId) {
        if (!childrenByNode.has(parentId)) {
          childrenByNode.set(parentId, []);
        }
        childrenByNode.get(parentId).push(n);
      }
    });

    // Helper functions with local caching
    const checkAny = (nodeId) => {
      if (hasAnyMap.has(nodeId)) return hasAnyMap.get(nodeId);
      
      const direct = usersByNode.get(nodeId);
      if (direct && direct.length > 0) {
        hasAnyMap.set(nodeId, true);
        return true;
      }
      
      const children = childrenByNode.get(nodeId) || [];
      const childHasAny = children.some(child => checkAny(child.id));
      hasAnyMap.set(nodeId, childHasAny);
      return childHasAny;
    };

    const checkOnline = (nodeId) => {
      if (hasOnlineMap.has(nodeId)) return hasOnlineMap.get(nodeId);

      const direct = usersByNode.get(nodeId) || [];
      if (direct.some(u => u.isOnline)) {
        hasOnlineMap.set(nodeId, true);
        return true;
      }

      const children = childrenByNode.get(nodeId) || [];
      const childHasOnline = children.some(child => checkOnline(child.id));
      hasOnlineMap.set(nodeId, childHasOnline);
      return childHasOnline;
    };

    // Precompute for all nodes
    filteredNodes.forEach(n => {
      checkAny(n.id);
      checkOnline(n.id);
    });

    return { hasAnyMap, hasOnlineMap };
  }, [filteredUsers, filteredNodes]);

  const hasOnlineUser = useCallback((nodeId) => {
    return userStatusMap.hasOnlineMap.get(nodeId) || false;
  }, [userStatusMap]);

  const hasAnyUser = useCallback((nodeId) => {
    return userStatusMap.hasAnyMap.get(nodeId) || false;
  }, [userStatusMap]);

  const nodesMap = useMemo(() => {
    // Use Number(n.id) as key to avoid string/number type mismatch in production builds
    return new Map(filteredNodes.map(n => [Number(n.id), n]));
  }, [filteredNodes]);

  const connections = useMemo(() => {
    if (!showLines) return [];
    const lines = [];

    filteredOltPorts.forEach(port => {
      const router = routers.find(r => Number(r.id) === Number(port.routerId));
      if (router && isValidCoord(router.latitude, router.longitude) && isValidCoord(port.latitude, port.longitude)) {
        lines.push({
          id: `router-olt-${port.id}`,
          coordinates: buildCableCoordinates(port.roadCoordinates, router.latitude, router.longitude, port.latitude, port.longitude),
          type: 'router-to-olt',
          color: '#0ea5e9',
          weight: 4,
          animate: true,
          label: `Router ${router.name} ➔ OLT Port ${port.name}`
        });
      }
    });

    filteredNodes.filter(n => n.type === 'ODC' && n.oltPortId && !n.incomingLinks?.length && !n.parentNodeId).forEach(node => {
      const port = filteredOltPorts.find(p => Number(p.id) === Number(node.oltPortId));
      if (isValidCoord(port?.latitude, port?.longitude) && isValidCoord(node.latitude, node.longitude)) {
        const anyUser = hasAnyUser(node.id);
        const isOnline = anyUser ? hasOnlineUser(node.id) : true;

        const isOltActive = activePopup?.type === 'oltPort';
        const activeSiblingPorts = isOltActive ? oltPorts.filter(p => {
          const activePortEntity = oltPorts.find(x => x.id === activePopup.id);
          const activeOltName = activePortEntity?.oltName || (activePortEntity?.name ? activePortEntity.name.split(" - Port ")[0] : '');
          const pOltName = p.oltName || (p.name ? p.name.split(" - Port ")[0] : '');
          return pOltName && pOltName === activeOltName;
        }) : [];
        const isFromSameOlt = isOltActive && activeSiblingPorts.some(p => Number(p.id) === Number(node.oltPortId));
        const isThisPortActive = isOltActive && Number(node.oltPortId) === Number(activePopup.id);

        let lineColor = !anyUser ? '#94a3b8' : (isOnline ? '#2563eb' : '#ef4444');
        let lineWeight = !anyUser ? 3 : (isOnline ? 4 : 5);
        let lineOpacity = 0.85;

        if (isOltActive && isFromSameOlt) {
          if (isThisPortActive) {
            lineColor = isOnline ? '#2563eb' : '#ef4444';
            lineWeight = 6;
            lineOpacity = 1.0;
          } else {
            lineColor = '#94a3b8';
            lineWeight = 2;
            lineOpacity = 0.25;
          }
        }

        lines.push({
          id: `olt-${node.id}`,
          coordinates: buildCableCoordinates(node.roadCoordinates, port.latitude, port.longitude, node.latitude, node.longitude),
          type: 'olt-to-odc',
          color: lineColor,
          weight: lineWeight,
          opacity: lineOpacity,
          dashArray: !anyUser ? '4,4' : (isOnline ? null : '8,6'),
          animate: !anyUser ? false : (isOltActive ? isThisPortActive && isOnline : isOnline),
          label: !anyUser ? `Feeder OLT ➔ ${node.name} (Kosong)` : (isOnline ? `Feeder OLT ➔ ${node.name}` : `⚠️ PUTUS: OLT ➔ ${node.name}`)
        });
      }
    });

    filteredNodes.forEach(node => {
      const parentId = node.incomingLinks?.[0]?.fromNodeId || node.parentNodeId;
      if (parentId) {
        // Use Number() to match Number-keyed nodesMap, preventing string/number mismatch
        const parent = nodesMap.get(Number(parentId));
        if (isValidCoord(parent?.latitude, parent?.longitude) && isValidCoord(node.latitude, node.longitude)) {
          const anyUser = hasAnyUser(node.id);
          const isOnline = anyUser ? hasOnlineUser(node.id) : true;
          const isODP = node.type === 'ODP';
          
          let defaultColor = isODP ? '#f59e0b' : '#8b5cf6';
          let lineColor = !anyUser ? '#94a3b8' : (isOnline ? defaultColor : '#ef4444');
          let lineDash = !anyUser ? '4,4' : (isOnline ? null : '8,6');

          lines.push({
            id: `node-${node.id}`,
            coordinates: buildCableCoordinates(node.roadCoordinates, parent.latitude, parent.longitude, node.latitude, node.longitude),
            type: isODP ? 'odc-to-odp' : 'node-to-node',
            color: lineColor,
            weight: !anyUser ? 3 : (isOnline ? 4 : 5),
            dashArray: lineDash,
            animate: !anyUser ? false : isOnline,
            label: `Distribusi ${parent.name} ➔ ${node.name}`
          });
        }
      }
    });

    if (shouldShowClients) {
        filteredUsers.forEach(user => {
        if (user.topologyNodeId) {
            const node = nodesMap.get(Number(user.topologyNodeId));
            if (isValidCoord(user.latitude, user.longitude) && isValidCoord(node?.latitude, node?.longitude) && node?.type === 'ODP') {
            const isUserOnline = user.isOnline;
            lines.push({
                id: `client-${user.id}`,
                coordinates: buildCableCoordinates(user.roadCoordinates, node.latitude, node.longitude, user.latitude, user.longitude),
                type: 'odp-to-client',
                color: isUserOnline ? '#10b981' : '#ef4444',
                weight: isUserOnline ? 3 : 4,
                dashArray: isUserOnline ? null : '6,6',
                animate: isUserOnline,
                label: `Drop: ${node.name} ➔ ${user.username}`
            });
            }
        }
        });
    }

    return lines;
  }, [filteredOltPorts, filteredNodes, filteredUsers, hasOnlineUser, hasAnyUser, routers, showLines, shouldShowClients, nodesMap, activePopup, oltPorts]);

  const visibleConnections = useMemo(() => {
    return connections;
  }, [connections]);

  const handleMarkerClick = useCallback((entity, type) => {
    if (type === 'node') {
      let groupIndex = -1;
      let targetGroup = null;
      for (let i = 0; i < groupedNodes.length; i++) {
        if (groupedNodes[i].some(n => Number(n.id) === Number(entity.id))) {
          groupIndex = i;
          targetGroup = groupedNodes[i];
          break;
        }
      }
      if (targetGroup && targetGroup.length > 1) {
        setActiveGroupDetailNode(entity);
        setActivePopup({ id: groupIndex, type: 'group' });
      } else {
        setActivePopup({ id: entity.id, type });
      }
    } else if (type === 'client') {
      let groupIndex = -1;
      let targetGroup = null;
      for (let i = 0; i < groupedUsers.length; i++) {
        if (groupedUsers[i].some(u => Number(u.id) === Number(entity.id))) {
          groupIndex = i;
          targetGroup = groupedUsers[i];
          break;
        }
      }
      if (targetGroup && targetGroup.length > 1) {
        setActiveGroupDetailClient(entity);
        setActivePopup({ id: groupIndex, type: 'clientGroup' });
      } else {
        setActivePopup({ id: entity.id, type });
      }
    } else {
      setActivePopup({ id: entity.id, type });
    }

    if (mapInstance && entity.latitude && entity.longitude && isValidCoord(entity.latitude, entity.longitude)) {
      const offsetLat = Number(entity.latitude) + 0.0006;
      const targetLatLng = L.latLng(offsetLat, Number(entity.longitude));
      const actualLatLng = L.latLng(Number(entity.latitude), Number(entity.longitude));
      mapInstance.stop();
      
      const currentZoom = mapInstance.getZoom();
      const dist = mapInstance.getCenter().distanceTo(actualLatLng);
      
      if (dist < 500 && Math.abs(currentZoom - 18) <= 1) {
        mapInstance.setView(targetLatLng, 18, { animate: true, duration: 0.5 });
      } else {
        mapInstance.flyTo(targetLatLng, 18, { animate: true, duration: 1.2 });
      }
    }
    if (type === 'oltPort' && onOltPortClick) onOltPortClick(entity.id);
    else if (type === 'node' && onNodeClick) onNodeClick(entity.id);
   }, [onNodeClick, onOltPortClick, mapInstance, groupedNodes, groupedUsers]);

  const handleNavigateToEntity = useCallback((entityId, type) => {
    // 1. Find the target entity
    let entity = null;
    if (type === 'client') {
      entity = pppoeUsers.find(u => Number(u.id) === Number(entityId) || u.username === entityId);
    } else if (type === 'node') {
      // ODP IDs in the frontend nodes array = database_id + 100000
      entity = nodes.find(n => {
        if (n.type === 'ODC') return Number(n.id) === Number(entityId);
        if (n.type === 'ODP') return (
          Number(n.id) === Number(entityId) + 100000 ||
          Number(n.id) === Number(entityId)
        );
        return false;
      });
    } else if (type === 'oltPort') {
      entity = oltPorts.find(p => Number(p.id) === Number(entityId));
    }

    if (!entity) {
      setPortDetailNode(null);
      return;
    }

    // 2. Find which group this entity belongs to (if any)
    let groupIndex = -1;
    let targetGroup = null;
    if (type === 'node') {
      for (let i = 0; i < groupedNodes.length; i++) {
        if (groupedNodes[i].some(n => n.id === entity.id)) {
          groupIndex = i;
          targetGroup = groupedNodes[i];
          break;
        }
      }
    } else if (type === 'client') {
      for (let i = 0; i < groupedUsers.length; i++) {
        if (groupedUsers[i].some(u => u.id === entity.id)) {
          groupIndex = i;
          targetGroup = groupedUsers[i];
          break;
        }
      }
    }

    // 3. Close modal first
    setPortDetailNode(null);

    // 4. Reset popup state to guarantee React detects a state change
    setActivePopup(null);
    setActiveGroupDetailNode(null);

    // 5. After modal unmounts, open the correct popup and pan map
    setTimeout(() => {
      if (type === 'node' && targetGroup && targetGroup.length > 1) {
        setActiveGroupDetailNode(entity);
        setActivePopup({ id: groupIndex, type: 'group' });
      } else if (type === 'client' && targetGroup && targetGroup.length > 1) {
        setActiveGroupDetailClient(entity);
        setActivePopup({ id: groupIndex, type: 'clientGroup' });
      } else {
        setActivePopup({ id: entity.id, type });
      }

      // Pan/fly map to entity location
      if (mapInstance && entity.latitude && entity.longitude && isValidCoord(entity.latitude, entity.longitude)) {
        const offsetLat = Number(entity.latitude) + 0.0006;
        const targetLatLng = L.latLng(offsetLat, Number(entity.longitude));
        const actualLatLng = L.latLng(Number(entity.latitude), Number(entity.longitude));
        mapInstance.stop();
        const dist = mapInstance.getCenter().distanceTo(actualLatLng);
        const currentZoom = mapInstance.getZoom();
        if (dist < 500 && Math.abs(currentZoom - 18) <= 1) {
          mapInstance.setView(targetLatLng, 18, { animate: true, duration: 0.5 });
        } else {
          mapInstance.flyTo(targetLatLng, 18, { animate: true, duration: 1.2 });
        }
      }
    }, 120);
  }, [nodes, pppoeUsers, oltPorts, groupedNodes, groupedUsers, mapInstance,
      setActivePopup, setActiveGroupDetailNode, setActiveGroupDetailClient]);

  const handleGroupMarkerClick = useCallback((centerEntity, index) => {
    setActiveGroupDetailNode(null);
    setActivePopup({ id: index, type: 'group' });
    if (mapInstance && centerEntity.latitude && centerEntity.longitude && isValidCoord(centerEntity.latitude, centerEntity.longitude)) {
      const offsetLat = Number(centerEntity.latitude) + 0.0006;
      const targetLatLng = L.latLng(offsetLat, Number(centerEntity.longitude));
      const actualLatLng = L.latLng(Number(centerEntity.latitude), Number(centerEntity.longitude));
      mapInstance.stop();
      
      const currentZoom = mapInstance.getZoom();
      const dist = mapInstance.getCenter().distanceTo(actualLatLng);
      
      if (dist < 500 && Math.abs(currentZoom - 18) <= 1) {
        mapInstance.setView(targetLatLng, 18, { animate: true, duration: 0.5 });
      } else {
        mapInstance.flyTo(targetLatLng, 18, { animate: true, duration: 1.2 });
      }
    }
  }, [mapInstance]);

  const handleGroupClientMarkerClick = useCallback((centerEntity, index) => {
    setActiveGroupDetailClient(null);
    setActivePopup({ id: index, type: 'clientGroup' });
    if (mapInstance && centerEntity.latitude && centerEntity.longitude && isValidCoord(centerEntity.latitude, centerEntity.longitude)) {
      const offsetLat = Number(centerEntity.latitude) + 0.0006;
      const targetLatLng = L.latLng(offsetLat, Number(centerEntity.longitude));
      const actualLatLng = L.latLng(Number(centerEntity.latitude), Number(centerEntity.longitude));
      mapInstance.stop();
      
      const currentZoom = mapInstance.getZoom();
      const dist = mapInstance.getCenter().distanceTo(actualLatLng);
      
      if (dist < 500 && Math.abs(currentZoom - 18) <= 1) {
        mapInstance.setView(targetLatLng, 18, { animate: true, duration: 0.5 });
      } else {
        mapInstance.flyTo(targetLatLng, 18, { animate: true, duration: 1.2 });
      }
    }
  }, [mapInstance]);

  const handleSearchSelect = (item) => {
    setSearchTerm(item._label);
    setShowSearchResults(false);
    handleMarkerClick(item, item._type);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      handleSearchSelect(searchResults[0]);
    }
  };

  const handleSearchScroll = (e) => {
    const target = e.target;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 40) {
      if (visibleSearchCount < searchResults.length) {
        setVisibleSearchCount(prev => prev + 10);
      }
    }
  };

  // POPUP RENDERERS
  const renderGroupedEntityPopup = useCallback((group, index) => {
    const isOpen = activePopup?.id === index && activePopup?.type === 'group';
    const entity = activeGroupDetailNode || group[0];
    const tKey = entity ? (entity.type === 'node' ? entity.type : entity.type) : 'ODP';
    const conf = MARKER_CONFIG[tKey] || MARKER_CONFIG.client;

    const popupKey = `group-${index}`;
    return (
      <Popup key={popupKey} minWidth={450} autoPan={false} className={`custom-detail-popup two-column-popup ${isDarkMode ? 'dark-popup' : ''}`} eventHandlers={{ remove: () => { setActivePopup(prev => (prev?.id === index && prev?.type === 'group') ? null : prev); setActiveGroupDetailNode(null); } }}>
          {isOpen ? (
              <div className="d-flex" style={{ width: '550px' }}>
                  {/* Left Column: List of Stacked Nodes */}
                  <div className="pe-3 border-right-custom" style={{ width: '220px', flexShrink: 0 }}>
                      <div className="d-flex align-items-center gap-2 mb-2 pb-2 border-bottom">
                          <div className="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white" style={{ width: '20px', height: '20px' }}>
                              <i className="bi bi-hdd-stack-fill" style={{ fontSize: '11px' }}></i>
                          </div>
                          <h6 className="mb-0 fw-bold text-truncate" style={{ fontSize: '12px', maxWidth: '160px' }}>{group.length} Node Bertumpuk</h6>
                      </div>
                      <div className="popup-body mt-2 custom-scrollbar" style={{ fontSize: '11px', maxHeight: '200px', overflowY: 'auto' }}>
                          {group.map((item, i) => {
                              const isSelected = activeGroupDetailNode?.id === item.id;
                              return (
                                  <div key={i} className={`py-1 px-2 mb-1 rounded d-flex justify-content-between align-items-center ${isSelected ? 'bg-primary-subtle text-primary-emphasis fw-semibold' : ''}`} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                                      <div className="text-truncate" style={{ maxWidth: '120px' }}>
                                          <span className="d-block text-truncate" style={{ fontSize: '11px' }}>{item.name}</span>
                                      </div>
                                      <button 
                                          className={`btn btn-sm ${isSelected ? 'btn-primary text-white' : 'btn-outline-primary'}`} 
                                          style={{ fontSize: '9px', padding: '2px 6px' }} 
                                          onClick={() => setActiveGroupDetailNode(item)}
                                      >
                                          Detail
                                      </button>
                                  </div>
                              );
                          })}
                      </div>
                  </div>

                  {/* Right Column: Node Details */}
                  <div className="d-flex flex-column px-2" style={{ flexGrow: 1, minWidth: '280px' }}>
                      {entity ? (
                          <>
                              {(() => {
                                const status = getMapEntityStatus(entity, 'node', { hasOnlineUser });
                                return (
                              <div className="popup-header d-flex align-items-center gap-2 mb-2 pb-2 border-bottom">
                                  <div className="rounded-circle d-flex align-items-center justify-content-center text-white" style={{ width: '24px', height: '24px', background: status.color, flexShrink: 0 }}>
                                      <i className={`bi ${conf.icon}`} style={{ fontSize: '12px' }}></i>
                                  </div>
                                  <h6 className="mb-0 fw-bold text-truncate" style={{ fontSize: '13px', maxWidth: '200px' }}>{entity.name}</h6>
                                  <span className={`badge ${status.badgeClass} ms-auto`} style={{ fontSize: '10px' }}>{status.label}</span>
                              </div>
                                );
                              })()}
                              <div className="popup-body custom-scrollbar" style={{ fontSize: '11px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                                  <div className="mb-2"><span className="text-muted d-block" style={{ fontSize: '10px' }}>Tipe</span><span className={`badge ${entity.type === 'ODP' ? 'bg-warning text-dark' : 'bg-success'}`}>{entity.type}</span></div>
                                  <div className="mb-2"><span className="text-muted d-block" style={{ fontSize: '10px' }}>Status</span><span className={`badge ${getMapEntityStatus(entity, 'node', { hasOnlineUser }).badgeClass}`}>{getMapEntityStatus(entity, 'node', { hasOnlineUser }).label}</span></div>
                                  {entity.description && <div className="mb-2"><span className="text-muted d-block" style={{ fontSize: '10px' }}>Deskripsi</span><strong className="text-wrap d-block" style={{ maxHeight: '60px', overflowY: 'auto' }}>{entity.description}</strong></div>}

                                  {(entity.photoUrl || entity.photoUrl2 || entity.photoUrl3 || entity.whatsapp || entity.address) && (
                                      <div className="mt-3 p-2 bg-light rounded border">
                                          <strong className="d-block mb-1 border-bottom pb-1" style={{ fontSize: '10px' }}>Informasi Lapangan</strong>
                                          {entity.whatsapp && <div className="mb-2"><i className="bi bi-whatsapp me-1 text-success"></i> <a href={`https://wa.me/${entity.whatsapp}`} target="_blank" rel="noreferrer" className="text-decoration-none text-success fw-bold">{entity.whatsapp}</a></div>}
                                          {entity.address && <div className="mb-2" style={{ fontSize: '10px' }}><i className="bi bi-geo-alt me-1 text-danger"></i> <span className="text-muted">{entity.address}</span></div>}
                                          {(entity.photoUrl || entity.photoUrl2 || entity.photoUrl3) && (
                                              <div className="mt-2">
                                                  <span className="d-block mb-1 text-muted" style={{ fontSize: '9px' }}><i className="bi bi-image me-1"></i> Preview Foto:</span>
                                                  <div className="d-flex gap-2 overflow-auto pb-1" style={{ maxWidth: '100%' }}>
                                                      {(() => {
                                                          const photos = [entity.photoUrl, entity.photoUrl2, entity.photoUrl3].filter(Boolean);
                                                          return photos.map((url, index) => (
                                                              <div 
                                                                  key={index} 
                                                                  className="flex-shrink-0"
                                                                  style={{ cursor: 'pointer' }}
                                                                  onClick={() => setLightbox({ isOpen: true, index, images: photos })}
                                                                  title="Klik untuk memperbesar"
                                                              >
                                                                  <img src={url} alt={`Foto ${index + 1}`} className="img-fluid rounded border hover-shadow" style={{ height: '70px', width: 'auto', objectFit: 'cover' }} />
                                                              </div>
                                                          ));
                                                      })()}
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  )}
                                  <button
                                      className="btn btn-sm btn-primary w-100 mt-2 fw-semibold"
                                      style={{ fontSize: '10px', borderRadius: '6px' }}
                                      type="button"
                                      onClick={e => { e.stopPropagation(); setPortDetailNode(entity); }}
                                  >
                                      <i className="bi bi-grid-3x3-gap-fill me-1"></i> Detail Port
                                  </button>
                              </div>
                          </>
                      ) : (
                          <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted p-3 text-center" style={{ flexGrow: 1, border: '1px dashed rgba(0,0,0,0.1)', borderRadius: '8px', minHeight: '200px' }}>
                              <i className="bi bi-info-circle mb-2 text-primary" style={{ fontSize: '24px' }}></i>
                              <span style={{ fontSize: '11px', lineHeight: '1.4' }}>Pilih salah satu node di sebelah kiri untuk melihat detail informasi.</span>
                          </div>
                      )}
                  </div>
              </div>
          ) : (
              <div style={{ padding: '6px 10px', fontSize: '11px', color: '#94a3b8' }}><i className="bi bi-arrow-repeat spin me-1"></i> Memuat informasi...</div>
          )}
      </Popup>
    );
  }, [activePopup, activeGroupDetailNode, isDarkMode, setActivePopup, setActiveGroupDetailNode, setLightbox, setPortDetailNode, hasOnlineUser]);

  const renderGroupedClientPopup = useCallback((group, index) => {
    const isOpen = activePopup?.id === index && activePopup?.type === 'clientGroup';
    const entity = activeGroupDetailClient || group[0];
    const conf = MARKER_CONFIG.client;

    const popupKey = `client-group-${index}`;
    return (
      <Popup key={popupKey} minWidth={450} autoPan={false} className={`custom-detail-popup two-column-popup ${isDarkMode ? 'dark-popup' : ''}`} eventHandlers={{ remove: () => { setActivePopup(prev => (prev?.id === index && prev?.type === 'clientGroup') ? null : prev); setActiveGroupDetailClient(null); } }}>
          {isOpen ? (
              <div className="d-flex" style={{ width: '550px' }}>
                  {/* Left Column: List of Stacked Clients */}
                  <div className="pe-3 border-right-custom" style={{ width: '220px', flexShrink: 0 }}>
                      <div className="d-flex align-items-center gap-2 mb-2 pb-2 border-bottom">
                          <div className="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white" style={{ width: '20px', height: '20px' }}>
                              <i className="bi bi-people-fill" style={{ fontSize: '11px' }}></i>
                          </div>
                          <h6 className="mb-0 fw-bold text-truncate" style={{ fontSize: '12px', maxWidth: '160px' }}>{group.length} Client Bertumpuk</h6>
                      </div>
                      <div className="popup-body mt-2 custom-scrollbar" style={{ fontSize: '11px', maxHeight: '200px', overflowY: 'auto' }}>
                          {group.map((item, i) => {
                              const isSelected = activeGroupDetailClient?.id === item.id;
                              return (
                                  <div key={i} className={`py-1 px-2 mb-1 rounded d-flex justify-content-between align-items-center ${isSelected ? 'bg-primary-subtle text-primary-emphasis fw-semibold' : ''}`} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                                      <div className="text-truncate" style={{ maxWidth: '120px' }}>
                                          <span className="d-block text-truncate" style={{ fontSize: '11px' }}>{item.username}</span>
                                      </div>
                                      <button 
                                          className={`btn btn-sm ${isSelected ? 'btn-primary text-white' : 'btn-outline-primary'}`} 
                                          style={{ fontSize: '9px', padding: '2px 6px' }} 
                                          onClick={() => setActiveGroupDetailClient(item)}
                                      >
                                          Detail
                                      </button>
                                  </div>
                              );
                          })}
                      </div>
                  </div>

                  {/* Right Column: Client Details */}
                  <div className="d-flex flex-column" style={{ flexGrow: 1, minWidth: '280px' }}>
                      {entity ? (
                          <>
                              <div className="popup-header d-flex align-items-center gap-2 mb-2 pb-2 border-bottom">
                                  <div className="rounded-circle d-flex align-items-center justify-content-center text-white" style={{ width: '24px', height: '24px', background: entity.isOnline ? '#10b981' : '#ef4444', flexShrink: 0 }}>
                                      <i className={`bi ${conf.icon}`} style={{ fontSize: '12px' }}></i>
                                  </div>
                                  <h6 className="mb-0 fw-bold text-truncate" style={{ fontSize: '13px', maxWidth: '200px' }}>{entity.username}</h6>
                              </div>
                              <div className="popup-body custom-scrollbar" style={{ fontSize: '11px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                                  <div className="mb-2"><span className="text-muted d-block" style={{ fontSize: '10px' }}>Profile</span><strong>{entity.profile || '—'}</strong></div>
                                  <div className="mb-2"><span className="text-muted d-block" style={{ fontSize: '10px' }}>IP Address</span><strong className="font-monospace">{entity.remoteAddress || '—'}</strong></div>
                                  {entity.isOnline && entity.uptime && (
                                      <div className="mb-2"><span className="text-muted d-block" style={{ fontSize: '10px' }}>Uptime</span><strong>{entity.uptime}</strong></div>
                                  )}
                                  <div className="mb-2">
                                      <span className="text-muted d-block" style={{ fontSize: '10px' }}>Traffic Rate</span>
                                      <strong>↓ {entity.rxHuman || '0 bps'} / ↑ {entity.txHuman || '0 bps'}</strong>
                                  </div>
                                  <div className="mb-2"><span className="text-muted d-block" style={{ fontSize: '10px' }}>Status</span><span className={`badge ${entity.isOnline ? 'bg-success' : 'bg-danger'}`}>{entity.isOnline ? 'Online' : 'Offline'}</span></div>

                                  {(entity.photoUrl || entity.photoUrl2 || entity.photoUrl3 || entity.whatsapp || entity.address) && (
                                      <div className="mt-3 p-2 bg-light rounded border">
                                          <strong className="d-block mb-1 border-bottom pb-1" style={{ fontSize: '10px' }}>Informasi Lapangan</strong>
                                          {entity.whatsapp && <div className="mb-2"><i className="bi bi-whatsapp me-1 text-success"></i> <a href={`https://wa.me/${entity.whatsapp}`} target="_blank" rel="noreferrer" className="text-decoration-none text-success fw-bold">{entity.whatsapp}</a></div>}
                                          {entity.address && <div className="mb-2" style={{ fontSize: '10px' }}><i className="bi bi-geo-alt me-1 text-danger"></i> <span className="text-muted">{entity.address}</span></div>}
                                          {(entity.photoUrl || entity.photoUrl2 || entity.photoUrl3) && (
                                              <div className="mt-2">
                                                  <span className="d-block mb-1 text-muted" style={{ fontSize: '9px' }}><i className="bi bi-image me-1"></i> Preview Foto:</span>
                                                  <div className="d-flex gap-2 overflow-auto pb-1" style={{ maxWidth: '100%' }}>
                                                      {(() => {
                                                          const photos = [entity.photoUrl, entity.photoUrl2, entity.photoUrl3].filter(Boolean);
                                                          return photos.map((url, index) => (
                                                              <div 
                                                                  key={index} 
                                                                  className="flex-shrink-0"
                                                                  style={{ cursor: 'pointer' }}
                                                                  onClick={() => setLightbox({ isOpen: true, index, images: photos })}
                                                                  title="Klik untuk memperbesar"
                                                              >
                                                                  <img src={url} alt={`Foto ${index + 1}`} className="img-fluid rounded border hover-shadow" style={{ height: '70px', width: 'auto', objectFit: 'cover' }} />
                                                              </div>
                                                          ));
                                                      })()}
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  )}
                              </div>
                          </>
                      ) : (
                          <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted p-3 text-center" style={{ flexGrow: 1, border: '1px dashed rgba(0,0,0,0.1)', borderRadius: '8px', minHeight: '200px' }}>
                              <i className="bi bi-info-circle mb-2 text-primary" style={{ fontSize: '24px' }}></i>
                              <span style={{ fontSize: '11px', lineHeight: '1.4' }}>Pilih salah satu client di sebelah kiri untuk melihat detail informasi lapangan.</span>
                          </div>
                      )}
                  </div>
              </div>
          ) : (
              <div style={{ padding: '6px 10px', fontSize: '11px', color: '#94a3b8' }}><i className="bi bi-arrow-repeat spin me-1"></i> Memuat informasi...</div>
          )}
      </Popup>
    );
  }, [activePopup, activeGroupDetailClient, isDarkMode, setActivePopup, setActiveGroupDetailClient, setLightbox]);

  const renderEntityPopup = useCallback((entity, type) => {
    const tKey = type === 'node' ? entity.type : type;
    const conf = MARKER_CONFIG[tKey] || MARKER_CONFIG.client;

    // ── OLT PORT: always render content immediately ──────────────────────────
    // Data is already in `entity` (no async fetch needed). We do NOT gate on
    // activePopup here to avoid the "Memuat informasi..." stuck state that
    // occurred because Leaflet opens the popup synchronously before React state
    // updates.
    if (type === 'oltPort') {
      const currentOltName = entity.oltName || (entity.name ? entity.name.split(' - Port ')[0] : '—');
      // Stable key: React won't unmount/remount the Popup when switching ports
      const popupKey = `entity-olt-${currentOltName}`;
      // Which port is currently selected? Use activePopup if it's an OLT port
      // from THIS OLT; otherwise fall back to entity (the marker's representative port).
      const activePortId = (activePopup?.type === 'oltPort') ? activePopup.id : entity.id;
      // Sibling ports — all ports that share this OLT device
      const siblingPorts = oltPorts
        .filter(p => {
          const pOltName = p.oltName || (p.name ? p.name.split(' - Port ')[0] : '');
          return pOltName === currentOltName;
        })
        .sort((a, b) => Number(a.portNumber || 0) - Number(b.portNumber || 0));
      const status = getMapEntityStatus(entity, 'oltPort', { routers });

      return (
        <Popup key={popupKey} minWidth={280} autoPan={false}
          className={`custom-detail-popup ${isDarkMode ? 'dark-popup' : ''}`}
          eventHandlers={{ remove: () => setActivePopup(prev => (prev?.id === activePortId && prev?.type === 'oltPort') ? null : prev) }}
        >
          {/* header */}
          <div className="popup-header d-flex align-items-center gap-2">
            <div className="rounded-circle d-flex align-items-center justify-content-center text-white"
              style={{ width: 28, height: 28, background: status.color, flexShrink: 0 }}>
              <i className={`bi ${conf.icon}`} style={{ fontSize: 14 }}></i>
            </div>
            <h6 className="mb-0 fw-bold text-truncate" style={{ fontSize: 14 }}>
              {currentOltName}
            </h6>
            <span className={`badge ${status.badgeClass} ms-auto`} style={{ fontSize: 10 }}>{status.label}</span>
          </div>
          {/* body */}
          <div className="popup-body mt-2" style={{ fontSize: 12 }}>
            <div className="mb-2 pb-2 border-bottom">
              <span className="text-muted">OLT Device:</span> <strong>{currentOltName}</strong>
              <div className="mt-1">
                <span className="text-muted">Status:</span> <span className={`badge ${status.badgeClass}`}>{status.label}</span>
              </div>
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }} className="custom-scrollbar">
              {siblingPorts.length === 0 ? (
                <span className="text-muted" style={{ fontSize: 11 }}>Tidak ada port ditemukan</span>
              ) : siblingPorts.map(port => {
                const isSelected = Number(port.id) === Number(activePortId);
                const connectedOdcs = nodes.filter(n => n.type === 'ODC' && Number(n.oltPortId) === Number(port.id));
                return (
                  <div
                    key={port.id}
                    className={`mb-2 p-2 rounded border ${isSelected ? 'bg-primary-subtle border-primary-subtle' : 'bg-light-subtle border-light-subtle'}`}
                    style={{ cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); setActivePopup({ id: port.id, type: 'oltPort' }); }}
                  >
                    <div className="d-flex align-items-center gap-1 mb-1">
                      <span className={`fw-bold ${isSelected ? 'text-primary' : 'text-body-emphasis'}`}>
                        Port {port.portNumber != null ? port.portNumber : (port.port ? port.port.replace('PON ', '') : '—')}
                      </span>
                      <span className={`badge ${getMapEntityStatus(port, 'oltPort', { routers }).badgeClass}`} style={{ fontSize: 8 }}>
                        {getMapEntityStatus(port, 'oltPort', { routers }).label}
                      </span>
                      {isSelected && <span className="badge bg-primary ms-1" style={{ fontSize: 8 }}>Dipilih</span>}
                    </div>
                    <div style={{ fontSize: 11 }}>
                      {connectedOdcs.length > 0 ? (
                        <div className="d-flex flex-wrap gap-1">
                          {connectedOdcs.map(odc => (
                            <span
                              key={odc.id}
                              className="badge bg-primary text-white"
                              style={{ fontSize: 9, cursor: 'pointer' }}
                              title={`Klik untuk menuju ke ${odc.name}`}
                              onClick={e => {
                                e.stopPropagation();
                                handleMarkerClick(odc, 'node');
                              }}
                            >
                              <i className="bi bi-diagram-3-fill me-1"></i>{odc.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 10 }}>Belum terhubung ke ODC</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button
                className="btn btn-sm btn-outline-primary w-100 mt-2 fw-semibold"
                onClick={e => { e.stopPropagation(); setPortDetailNode({ ...entity, type: 'oltPort' }); }}
                style={{ fontSize: '11px', borderRadius: '6px' }}
            >
                <i className="bi bi-grid-3x3-gap-fill me-1"></i> Lihat Detail Port
            </button>
          </div>
        </Popup>
      );
    }

    // ── ALL OTHER TYPES: gate on activePopup (original behaviour) ───────────
    const isOpen = activePopup?.id === entity.id && activePopup?.type === type;
    const popupKey = `entity-${entity.id}-${type}`;
    const status = getMapEntityStatus(entity, type, { routers, hasOnlineUser });

    return (
        <Popup key={popupKey} minWidth={260} autoPan={false} className={`custom-detail-popup ${isDarkMode ? 'dark-popup' : ''}`} eventHandlers={{ remove: () => setActivePopup(prev => (prev?.id === entity.id && prev?.type === type) ? null : prev) }}>
            {isOpen ? (
                <>
                    <div className="popup-header d-flex align-items-center gap-2">
                        <div className="rounded-circle d-flex align-items-center justify-content-center text-white" style={{ width: '28px', height: '28px', background: status.color, flexShrink: 0 }}>
                            <i className={`bi ${conf.icon}`} style={{ fontSize: '14px' }}></i>
                        </div>
                        <h6 className="mb-0 fw-bold text-truncate" style={{ fontSize: '14px' }}>{entity.name || entity.username}</h6>
                        <span className={`badge ${status.badgeClass} ms-auto`} style={{ fontSize: '10px' }}>{status.label}</span>
                    </div>
                    <div className="popup-body mt-2" style={{ fontSize: '12px' }}>
                        {type === 'router' && (
                            <>
                                <div className="mb-1"><span className="text-muted">Status:</span> <span className={`badge ${status.badgeClass}`}>{status.label}</span></div>
                                <div className="mb-1"><span className="text-muted">IP Address:</span> <strong>{entity.host || '—'}</strong></div>
                                <div className="mb-1"><span className="text-muted">Port:</span> <strong>{entity.port || 8728}</strong></div>
                                <div className="mb-1"><span className="text-muted">Last Seen:</span> <strong>{entity.lastSeen ? new Date(entity.lastSeen).toLocaleString('id-ID') : '—'}</strong></div>
                                <div className="mb-1"><span className="text-muted">Total OLT Port:</span> <strong>{oltPorts.filter(p => p.routerId === entity.id).length}</strong></div>
                                <div className="mb-1"><span className="text-muted">Total Clients:</span> <strong>{pppoeUsers.filter(u => u.routerId === entity.id).length} ({pppoeUsers.filter(u => u.routerId === entity.id && u.isOnline).length} Online)</strong></div>
                                <button
                                    className="btn btn-sm btn-outline-primary w-100 mt-2 fw-semibold"
                                    type="button"
                                    onClick={e => { e.stopPropagation(); setPortDetailNode({ ...entity, type: 'Router' }); }}
                                    style={{ fontSize: '11px', borderRadius: '6px' }}
                                >
                                    <i className="bi bi-grid-3x3-gap-fill me-1"></i> Lihat Detail Port
                                </button>
                            </>
                        )}
                        {type === 'node' && (
                            <>
                                <div className="mb-1"><span className="text-muted">Tipe:</span> <span className={`badge ${entity.type === 'ODP' ? 'bg-warning text-dark' : 'bg-success'}`}>{entity.type}</span></div>
                                <div className="mb-1"><span className="text-muted">Status:</span> <span className={`badge ${status.badgeClass}`}>{status.label}</span></div>
                                {entity.description && <div className="mb-1 text-muted text-truncate" style={{ maxWidth: '230px' }} title={entity.description}>{entity.description}</div>}
                                <button
                                    className="btn btn-sm btn-outline-primary w-100 mt-2 fw-semibold"
                                    type="button"
                                    onClick={e => { e.stopPropagation(); setPortDetailNode(entity); }}
                                    style={{ fontSize: '11px', borderRadius: '6px' }}
                                >
                                    <i className="bi bi-grid-3x3-gap-fill me-1"></i> Lihat Detail Port
                                </button>
                            </>
                        )}
                        {type === 'client' && (
                            <>
                                <div className="mb-1"><span className="text-muted">Profile:</span> <strong>{entity.profile || '—'}</strong></div>
                                <div className="mb-1"><span className="text-muted">IP:</span> <strong className="font-monospace">{entity.remoteAddress || '—'}</strong></div>
                                {entity.isOnline && entity.uptime && <div className="mb-1"><span className="text-muted">Uptime:</span> <strong>{entity.uptime}</strong></div>}
                                <div className="mb-1">
                                    <span className="text-muted">Traffic:</span>
                                    <strong>↓ {entity.rxHuman || '0 bps'} / ↑ {entity.txHuman || '0 bps'}</strong>
                                </div>
                                <div className="mb-1"><span className="text-muted">Status:</span> <span className={`badge ${status.badgeClass}`}>{status.label}</span></div>
                            </>
                        )}

                        {(type === 'node' || type === 'client') && (
                            <>
                                {(entity.photoUrl || entity.photoUrl2 || entity.photoUrl3 || entity.whatsapp || entity.address) && (
                                    <div className="mt-3 p-2 bg-light rounded border">
                                        <strong className="d-block mb-1 border-bottom pb-1" style={{ fontSize: '11px' }}>Informasi Lapangan</strong>
                                        {entity.whatsapp && <div className="mb-2"><i className="bi bi-whatsapp me-1 text-success"></i> <a href={`https://wa.me/${entity.whatsapp}`} target="_blank" rel="noreferrer" className="text-decoration-none text-success fw-bold">{entity.whatsapp}</a></div>}
                                        {entity.address && <div className="mb-2" style={{ fontSize: '11px' }}><i className="bi bi-geo-alt me-1 text-danger"></i> <span className="text-muted">{entity.address}</span></div>}
                                        {(entity.photoUrl || entity.photoUrl2 || entity.photoUrl3) && (
                                            <div className="mt-2">
                                                <span className="d-block mb-1 text-muted" style={{ fontSize: '10px' }}><i className="bi bi-image me-1"></i> Preview Foto:</span>
                                                <div className="d-flex gap-2 overflow-auto pb-1" style={{ maxWidth: '100%' }}>
                                                    {(() => {
                                                        const photos = [entity.photoUrl, entity.photoUrl2, entity.photoUrl3].filter(Boolean);
                                                        return photos.map((url, index) => (
                                                            <div 
                                                                key={index} 
                                                                className="flex-shrink-0"
                                                                style={{ cursor: 'pointer' }}
                                                                onClick={() => setLightbox({ isOpen: true, index, images: photos })}
                                                                title="Klik untuk memperbesar"
                                                            >
                                                                <img src={url} alt={`Foto ${index + 1}`} className="img-fluid rounded border hover-shadow" style={{ height: '90px', width: 'auto', objectFit: 'cover', transition: 'transform 0.2s' }} />
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                        {entity.latitude && (
                            <a href={`https://maps.google.com/?q=${entity.latitude},${entity.longitude}`} target="_blank" rel="noreferrer" className={`btn btn-sm w-100 mt-2 fw-medium border ${isDarkMode ? 'btn-dark text-info border-secondary' : 'btn-light text-primary'}`} style={{ fontSize: '12px' }}>
                                Open in Google Maps <i className="bi bi-box-arrow-up-right ms-1"></i>
                            </a>
                        )}
                    </div>
                </>
            ) : (
                <div style={{ padding: '6px 10px', fontSize: '11px', color: '#94a3b8' }}><i className="bi bi-arrow-repeat spin me-1"></i> Memuat informasi...</div>
            )}
        </Popup>
    );
  }, [isDarkMode, setActivePopup, setLightbox, activePopup, nodes, oltPorts, pppoeUsers, handleMarkerClick, setPortDetailNode, routers, hasOnlineUser]);



  const mapMarkers = useMemo(() => {
    if (!isDeferredReady) return null;
    const infraMarkers = [];
    const clientMarkers = [];

    if (showNodes) {
        routers.forEach(router => {
        if (!isValidCoord(router.latitude, router.longitude)) return;
        
        const isOpen = activePopup?.id === router.id && activePopup?.type === 'router';
        infraMarkers.push(
            <MemoizedMarker 
                key={`router-${router.id}`} 
                position={[Number(router.latitude), Number(router.longitude)]} 
                icon={createCustomIcon(getMapEntityStatus(router, 'router').color, MARKER_CONFIG.router.icon, !getMapEntityStatus(router, 'router').isOnline, 'router')} 
                onClick={() => handleMarkerClick(router, 'router')}
                isOpen={isOpen}
                renderPopup={() => renderEntityPopup(router, 'router')}
            />
        );
        });

        const oltGroupsMap = new Map();
        filteredOltPorts.forEach(port => {
            if (!isValidCoord(port.latitude, port.longitude)) return;
            const oltName = port.oltName || (port.name ? port.name.split(" - Port ")[0] : 'Unknown OLT');
            const key = `${oltName}_${Number(port.latitude).toFixed(6)}_${Number(port.longitude).toFixed(6)}`;
            if (!oltGroupsMap.has(key)) {
                oltGroupsMap.set(key, []);
            }
            oltGroupsMap.get(key).push(port);
        });

        oltGroupsMap.forEach((ports, key) => {
            ports.sort((a, b) => Number(a.portNumber || 0) - Number(b.portNumber || 0));
            const activePort = ports.find(p => Number(p.id) === Number(activePopup?.id) && activePopup?.type === 'oltPort') || ports[0];
            const isOpen = ports.some(p => Number(p.id) === Number(activePopup?.id) && activePopup?.type === 'oltPort');
            const status = getMapEntityStatus(activePort, 'oltPort', { routers });
            
            infraMarkers.push(
                <MemoizedMarker 
                    key={`olt-group-${key}`} 
                    position={[Number(activePort.latitude), Number(activePort.longitude)]} 
                    icon={createCustomIcon(status.color, MARKER_CONFIG.oltPort.icon, !status.isOnline, 'olt')} 
                    onClick={() => handleMarkerClick(activePort, 'oltPort')}
                    isOpen={isOpen}
                    renderPopup={() => renderEntityPopup(activePort, 'oltPort')}
                />
            );
        });

        groupedNodes.forEach((group, index) => {
            const center = group[0];
            if (group.length === 1) {
                const node = group[0];
                const config = node.type === 'ODP' ? MARKER_CONFIG.ODP : MARKER_CONFIG.ODC;
                const status = getMapEntityStatus(node, 'node', { hasOnlineUser });

                const isOpen = activePopup?.id === node.id && activePopup?.type === 'node';
                infraMarkers.push(
                    <MemoizedMarker 
                        key={`node-${node.id}`} 
                        position={[Number(node.latitude), Number(node.longitude)]} 
                        icon={createCustomIcon(status.isOnline ? config.color : status.color, config.icon, !status.isOnline, 'node')} 
                        onClick={() => handleMarkerClick(node, 'node')}
                        isOpen={isOpen}
                        renderPopup={() => renderEntityPopup(node, 'node')}
                    />
                );
            } else {
                const anyOffline = group.some(n => !getMapEntityStatus(n, 'node', { hasOnlineUser }).isOnline);
                const groupIcon = getGroupIcon(group.length, anyOffline);
                
                const isOpen = activePopup?.id === index && activePopup?.type === 'group';
                infraMarkers.push(
                    <MemoizedMarker 
                        key={`group-${index}`} 
                        position={[Number(center.latitude), Number(center.longitude)]} 
                        icon={groupIcon}
                        onClick={() => handleGroupMarkerClick(center, index)}
                        isOpen={isOpen}
                        renderPopup={() => renderGroupedEntityPopup(group, index)}
                    />
                );
            }
        });
    }

    if (shouldShowClients) {
        groupedUsers.forEach((group, index) => {
            const center = group[0];
            if (visibleBounds && !visibleBounds.contains([Number(center.latitude), Number(center.longitude)])) return;

            if (group.length === 1) {
                const user = group[0];
                const isOnline = user.isOnline;
                const markerColor = isOnline ? '#10b981' : '#ef4444';
                
                const isOpen = activePopup?.id === user.id && activePopup?.type === 'client';
                clientMarkers.push(
                    <MemoizedMarker 
                        key={`client-${user.id}`} 
                        position={[Number(user.latitude), Number(user.longitude)]} 
                        icon={createCustomIcon(markerColor, MARKER_CONFIG.client.icon, !isOnline, 'client')} 
                        onClick={() => handleMarkerClick(user, 'client')}
                        isOpen={isOpen}
                        renderPopup={() => renderEntityPopup(user, 'client')}
                    />
                );
            } else {
                const anyOnline = group.some(u => u.isOnline);
                const groupIcon = getClientGroupIcon(group.length, anyOnline);
                
                const isOpen = activePopup?.id === index && activePopup?.type === 'clientGroup';
                clientMarkers.push(
                    <MemoizedMarker 
                        key={`client-group-${index}`} 
                        position={[Number(center.latitude), Number(center.longitude)]} 
                        icon={groupIcon}
                        onClick={() => handleGroupClientMarkerClick(center, index)}
                        isOpen={isOpen}
                        renderPopup={() => renderGroupedClientPopup(group, index)}
                    />
                );
            }
        });
    }

    return (
      <>
        {infraMarkers}
        {clientMarkers}
      </>
    );
  }, [isDeferredReady, showNodes, routers, visibleBounds, activePopup, filteredOltPorts, groupedNodes, hasOnlineUser, handleMarkerClick, handleGroupMarkerClick, shouldShowClients, groupedUsers, handleGroupClientMarkerClick, renderEntityPopup, renderGroupedEntityPopup, renderGroupedClientPopup]);

  const activeRouters = routers.filter(r => r.isOnline).length;
  const totalRouters = routers.length;
  const onlineClients = filteredUsers.filter(u => u.isOnline).length;
  const totalClients = filteredUsers.length;
  const odcCount = filteredNodes.filter(n => n.type === 'ODC').length;
  const odpCount = filteredNodes.filter(n => n.type === 'ODP').length;
  const faultyNodesCount = filteredNodes.filter(n => hasAnyUser(n.id) && !hasOnlineUser(n.id)).length;

  useEffect(() => {
    if (mapInstance) {
      const t1 = setTimeout(() => mapInstance.invalidateSize(), 50);
      const t2 = setTimeout(() => mapInstance.invalidateSize(), 350);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [isFullScreen, mapInstance]);

  const handleCableClick = useCallback((line) => {
    setSelectedCable(line);
  }, []);

  const connectionLayers = useMemo(() => {
    return visibleConnections.map(line => (
      <MemoizedPolyline 
          key={`${line.id}-${line.color}`}
          id={line.id}
          coordinates={line.coordinates}
          color={line.color}
          weight={line.weight}
          dashArray={line.dashArray}
          label={line.label}
          isPopupOpen={activePopup?.type === 'cable' && activePopup?.id === line.id}
          onClick={() => {
            handleCableClick(line);
            setActivePopup({ id: line.id, type: 'cable' });
          }}
          onPopupClose={() => setActivePopup(null)}
      />
    ));
  }, [visibleConnections, activePopup, handleCableClick]);


  /* ───────────────── PPPoE USER MONITOR STATE & HOOK ───────────────── */
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);

  const {
    usersLoading,
    loadUsers,
    filteredUsers: pppoeFilteredUsers,
    onlineUsers: pppoeOnlineUsers,
    searchQuery,
    setSearchQuery,
    filterStatus,
    setFilterStatus,
    locationFilter,
    setLocationFilter,
    sortBy,
    setSortBy,
  } = usePppoeUserMonitor(selectedRouter);

  const [actionLoading, setActionLoading] = useState({});
  const [animatingRows, setAnimatingRows] = useState({});

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRouter, searchQuery, filterStatus, locationFilter, sortBy]);

  const handleSync = async () => {
    if (!selectedRouter) return;
    try {
      await api.post(`/pppoe/${selectedRouter}/sync`);
      await loadUsers(selectedRouter);
    } catch (err) {
      console.error(err);
      showAlert(err.response?.data?.message || "Sync failed", "Sync Gagal", "danger");
    }
  };

  const triggerRowAnimation = useCallback((userId) => {
    setAnimatingRows(prev => ({ ...prev, [userId]: true }));
    setTimeout(() => setAnimatingRows(prev => ({ ...prev, [userId]: false })), 600);
  }, []);

  const handleReconnectUser = useCallback(async (user) => {
    if (!selectedRouter) return;
    const username = user.username;
    const key = `reconnect-${username}`;
    
    setActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      const res = await api.post(`/pppoe/${selectedRouter}/user/${username}/kick`);
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to reconnect session");
      }
      triggerRowAnimation(username);
      await loadUsers(selectedRouter);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (err) {
      console.error(err);
      showAlert(err.response?.data?.message || err.message || "Failed to reconnect user session", "Gagal Reconnect", "danger");
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  }, [selectedRouter, loadUsers, triggerRowAnimation, showAlert]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return pppoeFilteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [pppoeFilteredUsers, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(pppoeFilteredUsers.length / itemsPerPage) || 1;
  }, [pppoeFilteredUsers.length, itemsPerPage]);

  // PPPoE Metrics
  const latest = metrics?.latest || {};
  const cpu = safeNumber(latest.cpu);
  const ram = safeNumber(latest.ram);
  const rx = safeNumber(latest.rx ?? latest.rxBps ?? latest.rxRaw);
  const tx = safeNumber(latest.tx ?? latest.txBps ?? latest.txRaw);

  function safeNumber(v) {
    return isNaN(Number(v)) ? 0 : Number(v);
  }
  function formatPercent(v) {
    return `${safeNumber(v).toFixed(1)}%`;
  }

  const pppoeOfflineCount = pppoeFilteredUsers.length - pppoeOnlineUsers;
  const pppoeLocatedCount = pppoeFilteredUsers.filter((u) => u.latitude && u.longitude).length;

  return (
    <>
      {/* CSS Animation Styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.98); }
        }
        .pulse-animation { animation: pulse 0.6s ease-in-out; }
        
        @keyframes rowHighlight {
          0% { background-color: rgba(13, 110, 253, 0.1); }
          100% { background-color: transparent; }
        }
        .row-animate { animation: rowHighlight 0.6s ease-out; }
        
        .btn-hover-scale { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .btn-hover-scale:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        
        .table-container { max-height: 500px; overflow-y: auto; }
        .table-container::-webkit-scrollbar { width: 6px; }
        .table-container::-webkit-scrollbar-track { background: #f1f1f1; }
        .table-container::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
        .table-container::-webkit-scrollbar-thumb:hover { background: #a1a1a1; }
      `}</style>

      <div className="container-fluid p-3 bg-body-secondary d-flex flex-column" style={{ minHeight: '100vh', overflowY: 'auto', transition: 'background-color 0.3s' }}>
        
        {/* ========================================================= */}
        {/* NOC DASHBOARD SECTION                                     */}
        {/* ========================================================= */}
        <div className="d-flex flex-column mb-4" style={{ height: 'calc(100vh - 100px)', minHeight: '600px' }}>
          
          {/* Dashboard Header */}
          <div className="d-flex justify-content-between align-items-center mb-3 flex-shrink-0">
            <div>
              <h3 className="fw-bold mb-1 text-body-emphasis" style={{ letterSpacing: '-0.5px' }}>Network Operations Center (Teknisi)</h3>
              <p className="text-muted mb-0 small">Real-time monitoring for FTTH topology and PPPoE clients</p>
            </div>
            <div className="d-flex gap-2 align-items-center">
                {isStandalone && routers.length > 0 && (
                    <div className="d-flex align-items-center bg-body border shadow-sm rounded-pill px-3 py-1 me-2">
                        <i className="bi bi-hdd-network text-primary me-2"></i>
                        <select 
                            className="form-select form-select-sm border-0 shadow-none bg-transparent fw-medium" 
                            value={selectedRouter || ''} 
                            onChange={(e) => {
                                const val = e.target.value;
                                setApiSelectedRouter(val ? Number(val) : null);
                                if (isRouterLocked && val) {
                                    localStorage.setItem('locked_router_id', val);
                                }
                            }}
                            style={{ width: 'auto', minWidth: '130px', cursor: 'pointer', paddingLeft: 0, boxShadow: 'none', outline: 'none' }}
                        >
                            {routers.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                        <button 
                            className={`btn btn-sm p-0 ms-2 ${isRouterLocked ? 'text-primary' : 'text-muted'}`}
                            onClick={() => {
                                const newLocked = !isRouterLocked;
                                setIsRouterLocked(newLocked);
                                localStorage.setItem('lock_router', newLocked);
                                if (newLocked && selectedRouter) {
                                    localStorage.setItem('locked_router_id', selectedRouter);
                                } else {
                                    localStorage.removeItem('locked_router_id');
                                }
                            }}
                            title={isRouterLocked ? "Buka kuncian router default" : "Kunci router ini sebagai default"}
                            style={{ border: 'none', background: 'transparent' }}
                        >
                            <i className={`bi ${isRouterLocked ? 'bi-lock-fill' : 'bi-unlock'}`}></i>
                        </button>
                    </div>
                )}
                <span className="badge bg-primary px-3 py-2 fs-6 rounded-pill d-flex align-items-center gap-2 shadow-sm">
                    <i className="bi bi-clock"></i>
                    {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
          </div>

          <DashboardKpiCards 
            activeRouters={activeRouters} 
            totalRouters={totalRouters} 
            onlineClients={onlineClients} 
            totalClients={totalClients} 
            odcCount={odcCount} 
            odpCount={odpCount} 
            faultyNodesCount={faultyNodesCount} 
            filteredNodesLength={filteredNodes.length || 1} 
          />

          <div className="row g-3 flex-grow-1" style={{ minHeight: 0 }}>
            {/* Main Map Section */}
            <div className={isFullScreen ? "position-fixed top-0 start-0 end-0 bottom-0 bg-white" : "col-lg-9 col-xl-9 h-100"} style={isFullScreen ? { zIndex: 1040, margin: 0, padding: 0 } : {}}>
              <div className={`card border-0 shadow-sm overflow-hidden position-relative ${isFullScreen ? 'rounded-0 w-100 h-100' : 'rounded-4 h-100'}`}>
                
                {/* Map Top UI Overlays */}
                <div className="position-absolute top-0 start-0 w-100 p-3 d-flex justify-content-between align-items-start z-1000" style={{ pointerEvents: 'none' }}>
                    
                    {/* Search & Filters */}
                    <div className="d-flex flex-column gap-2" style={{ pointerEvents: 'auto', width: '320px' }}>
                        <form onSubmit={handleSearchSubmit} className="position-relative">
                            <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" style={{ zIndex: 1, pointerEvents: 'none' }}></i>
                            <input 
                                type="text" 
                                className="form-control rounded-pill border-0 shadow-sm ps-5 pe-4 py-2 fw-medium" 
                                placeholder="Find client or node..." 
                                value={searchTerm}
                                autoComplete="off"
                                onChange={(e) => { setSearchTerm(e.target.value); setShowSearchResults(true); }}
                                onFocus={() => setShowSearchResults(true)}
                                onBlur={() => setTimeout(() => setShowSearchResults(false), 150)}
                            />
                            {searchTerm && (
                              <button type="button" className="btn btn-sm position-absolute top-50 end-0 translate-middle-y me-2 p-0 text-muted border-0 bg-transparent" onClick={() => { setSearchTerm(""); setShowSearchResults(false); }}>
                                <i className="bi bi-x-circle-fill" style={{ fontSize: '14px' }}></i>
                              </button>
                            )}
                            {showSearchResults && searchResults.length > 0 && (
                              <div 
                                className="position-absolute top-100 start-0 w-100 mt-1 rounded-3 overflow-hidden shadow-lg search-dropdown custom-scrollbar" 
                                style={{ zIndex: 9999, maxHeight: '378px', overflowY: 'auto', pointerEvents: 'auto' }}
                                onScroll={handleSearchScroll}
                              >
                                {searchResults.slice(0, visibleSearchCount).map((item) => (
                                  <button
                                    key={`${item._type}-${item.id}`}
                                    type="button"
                                    className="search-dropdown-item w-100 d-flex align-items-center gap-2 px-3 py-2 border-0 text-start"
                                    onMouseDown={() => handleSearchSelect(item)}
                                  >
                                    <span className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0" style={{ width: '28px', height: '28px', background: item._color, fontSize: '12px' }}>
                                      <i className={`bi ${item._icon}`}></i>
                                    </span>
                                    <div className="overflow-hidden">
                                      <div className="fw-medium text-truncate" style={{ fontSize: '13px' }}>{item._label}</div>
                                      <div className="text-muted" style={{ fontSize: '11px', textTransform: 'capitalize' }}>{item._type === 'client' ? (item.isOnline ? '🟢 Online' : '🔴 Offline') : item._type}</div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                        </form>

                        <details className="bg-body rounded-4 mt-2 group shadow-sm border" style={{ cursor: 'pointer' }}>
                            <summary className="p-3 fw-bold text-muted small text-uppercase" style={{ listStyle: 'none' }}>
                                <div className="d-flex justify-content-between align-items-center">
                                    <span><i className="bi bi-layers me-2"></i>Map Layers</span>
                                    <i className="bi bi-chevron-down"></i>
                                </div>
                            </summary>
                            <div className="p-3 pt-0">
                                <div className="form-check form-switch mb-2">
                                    <input className="form-check-input" type="checkbox" role="switch" checked={showClients} onChange={(e) => setShowClients(e.target.checked)} />
                                    <label className="form-check-label small fw-medium">
                                        Show Clients {showClients && !shouldShowClients && <span className="text-muted ms-1" style={{ fontSize: '10px' }}>(Zoom in to view)</span>}
                                    </label>
                                </div>
                                <div className="form-check form-switch mb-2">
                                    <input className="form-check-input" type="checkbox" role="switch" checked={showNodes} onChange={(e) => setShowNodes(e.target.checked)} />
                                    <label className="form-check-label small fw-medium">Show ODC/ODP Nodes</label>
                                </div>
                                <div className="form-check form-switch mb-0">
                                    <input className="form-check-input" type="checkbox" role="switch" checked={showLines} onChange={(e) => setShowLines(e.target.checked)} />
                                    <label className="form-check-label small fw-medium">Show Connections</label>
                                </div>
                            </div>
                        </details>
                    </div>

                    {/* Satellite Toggle */}
                    <div className="bg-body rounded-pill p-1 d-flex shadow-sm border" style={{ pointerEvents: 'auto' }}>
                        <button 
                            className={`btn btn-sm rounded-pill px-3 fw-medium ${mapType === 'vector' ? 'btn-primary' : 'btn-link text-body bg-transparent border-0 text-decoration-none'}`}
                            onClick={() => setMapType('vector')}
                        >
                            Vector
                        </button>
                        <button 
                            className={`btn btn-sm rounded-pill px-3 fw-medium ${mapType === 'satellite' ? 'btn-primary' : 'btn-link text-body bg-transparent border-0 text-decoration-none'}`}
                            onClick={() => setMapType('satellite')}
                        >
                            Satellite
                        </button>
                    </div>
                </div>

                <MapContainer 
                    center={mapCenter} 
                    zoom={8} 
                    scrollWheelZoom={true} 
                    style={{ height: '100%', width: '100%', outline: 'none' }}
                    zoomControl={false}
                    ref={setMapInstance}
                    renderer={canvasRenderer}
                    preferCanvas={true}
                    keyboard={false}
                >
                    <MapViewportListener onBoundsChange={setVisibleBounds} onZoomChange={setMapZoom} />
                    {mapType === 'vector' ? (
                        <>
                            {isDarkMode ? (
                                <TileLayer
                                    key="dark-tile"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                    maxZoom={20}
                                />
                            ) : (
                                <TileLayer
                                    key="light-tile"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                                    maxZoom={20}
                                />
                            )}
                        </>
                    ) : (
                        <TileLayer
                            attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
                            url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                            maxZoom={22}
                            subdomains={['mt0','mt1','mt2','mt3']}
                        />
                    )}
                    {connectionLayers}
                    {mapMarkers}

                    <FitMapBounds coordinates={allCoordinates} selectedRouter={selectedRouter} />
                </MapContainer>

                {/* Bottom Controls */}
                <div className="position-absolute bottom-0 end-0 p-3 z-1000 d-flex flex-column gap-2" style={{ pointerEvents: 'none' }}>
                    <button 
                        className="btn btn-white text-primary border-0 shadow rounded-circle d-flex align-items-center justify-content-center" 
                        style={{ width: '48px', height: '48px', pointerEvents: 'auto' }}
                        onClick={() => {
                            requestAnimationFrame(() => {
                                if (allCoordinates.length > 0 && mapInstance) {
                                    const validPoints = [];
                                    for (let i = 0; i < allCoordinates.length; i++) {
                                        const c = allCoordinates[i];
                                        if (c && c.lat != null && c.lng != null && !isNaN(c.lat) && !isNaN(c.lng)) {
                                            validPoints.push([c.lat, c.lng]);
                                        }
                                    }
                                    if (validPoints.length > 0) {
                                        const targetBounds = L.latLngBounds(validPoints).pad(0.1);
                                        mapInstance.stop();
                                        
                                        const targetZoom = mapInstance.getBoundsZoom(targetBounds);
                                        const currentZoom = mapInstance.getZoom();
                                        const dist = mapInstance.getCenter().distanceTo(targetBounds.getCenter());
                                        
                                        if (dist < 1000 && Math.abs(currentZoom - targetZoom) <= 1) {
                                            mapInstance.fitBounds(targetBounds, { animate: true, duration: 0.5 });
                                        } else {
                                            mapInstance.flyToBounds(targetBounds, { duration: 1.5, maxZoom: 16, easeLinearity: 0.25 });
                                        }
                                    }
                                }
                            });
                        }}
                        title="Fit Bounds to Markers"
                    >
                        <i className="bi bi-bullseye fs-5"></i>
                    </button>
                    <button 
                        className={`btn ${isFullScreen ? 'btn-danger' : 'btn-primary'} text-white border-0 shadow rounded-circle d-flex align-items-center justify-content-center`} 
                        style={{ width: '48px', height: '48px', pointerEvents: 'auto' }}
                        onClick={() => setIsFullScreen(!isFullScreen)}
                        title="Toggle Fullscreen"
                    >
                        <i className={`bi ${isFullScreen ? 'bi-fullscreen-exit' : 'bi-arrows-fullscreen'} fs-5`}></i>
                    </button>
                </div>

                {/* Cable Detail Panel */}
                {selectedCable && (
                  <div className="cable-edit-panel" style={{ pointerEvents: 'auto' }}>
                    <div className="cable-edit-header">
                      <h3 className="text-body-emphasis">Detail Koneksi Kabel</h3>
                      <button className="close-btn" onClick={() => setSelectedCable(null)}>×</button>
                    </div>
                    <div className="cable-edit-body">
                      <p className="cable-label text-body-emphasis"><strong>Kabel:</strong> {selectedCable.label}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Side Panel: Charts & Logs */}
            <div className="col-lg-3 col-xl-3 h-100 d-flex flex-column gap-3" style={isFullScreen ? { display: 'none' } : {}}>
              <DashboardBandwidthChart routersTrafficRef={routersTrafficRef} isDarkMode={isDarkMode} selectedRouter={selectedRouter} />
              <DashboardSystemLogs eventLogs={eventLogs} />
            </div>
          </div>

        </div>

        {/* ========================================================= */}
        {/* PPPoE USER SESSIONS LIST SECTION                          */}
        {/* ========================================================= */}
        <div className="mt-2 mb-4">
          
          {/* HEADER */}
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
            <div>
              <h3 className="fw-bold mb-1 text-body-emphasis">
                <i className="bi bi-router me-2 text-primary"></i>PPPoE Sessions
              </h3>
              <p className="text-muted mb-0 small">Monitor user connections active on the selected router</p>
            </div>
            <div className="d-flex align-items-center gap-2">
              <ConnectionBadge connected={monitorSocketConnected && isRouterConnected} />
              <button
                className="btn btn-warning btn-sm d-flex align-items-center gap-2 btn-hover-scale"
                onClick={handleSync}
              >
                <i className="bi bi-arrow-clockwise"></i>
                <span className="d-none d-sm-inline">Sync</span>
              </button>
            </div>
          </div>

          {/* CONTROL BAR */}
          <div className="card border-0 shadow-sm mb-3 rounded-4">
            <div className="card-body py-3">
              <div className="row g-2 align-items-end">
                <div className="col-md-3">
                  <label className="form-label small text-muted fw-semibold mb-1">Search</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label small text-muted fw-semibold mb-1">Status</label>
                  <select
                    className="form-select form-select-sm"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small text-muted fw-semibold mb-1">Location</label>
                  <select
                    className="form-select form-select-sm"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="has-location">📍 Has Location</option>
                    <option value="no-location">❌ No Location</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small text-muted fw-semibold mb-1">Sort By</label>
                  <select
                    className="form-select form-select-sm"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="name-asc">Name ↑</option>
                    <option value="name-desc">Name ↓</option>
                    <option value="uptime-desc">Uptime ↓</option>
                    <option value="uptime-asc">Uptime ↑</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ROUTER METRICS */}
          <div className="row g-3 mb-4">
            {["CPU Load", "RAM Usage", "RX Traffic", "TX Traffic"].map((label, idx) => {
              const values = [cpu, ram, rx, tx];
              const colors = ["text-danger", "text-warning", "text-success", "text-primary"];
              const format = idx < 2 ? formatPercent : formatTraffic;
              return (
                <div className="col-6 col-md-3" key={label}>
                  <div className="card border-0 shadow-sm h-100 rounded-4">
                    <div className="card-body py-3">
                      <div className="small text-muted text-uppercase fw-semibold mb-1">{label}</div>
                      <div className={`fs-4 fw-bold ${colors[idx]}`}>{format(values[idx])}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* USERS TABLE WITH PAGINATION */}
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-semibold text-body-emphasis">
                <i className="bi bi-people me-2"></i>User Sessions
                <span className="badge bg-secondary ms-2">{pppoeFilteredUsers.length}</span>
              </h5>
              <div className="small text-muted">
                <span className="text-success">{pppoeOnlineUsers} online</span> •{" "}
                <span className="text-danger">{pppoeOfflineCount} offline</span> •{" "}
                <span className="text-primary">{pppoeLocatedCount} located</span>
              </div>
            </div>
            
            {/* Pagination Top */}
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={pppoeFilteredUsers.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
            />
            
            <div className="table-container">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light sticky-top" style={{ zIndex: 1, background: "#fff" }}>
                  <tr>
                    <th style={{ width: "40px" }}>#</th>
                    <th>User</th>
                    <th>Status</th>
                    <th>IP Address</th>
                    <th>Uptime / Downtime</th>
                    <th className="text-end">RX</th>
                    <th className="text-end">TX</th>
                    <th>Location</th>
                    <th className="text-end" style={{ width: "80px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading && !pppoeFilteredUsers.length ? (
                    <tr>
                      <td colSpan="9" className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      </td>
                    </tr>
                  ) : !paginatedUsers.length && pppoeFilteredUsers.length > 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-5 text-muted">
                        <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                        <p className="mb-0">Halaman kosong. Coba ubah nomor halaman atau filter.</p>
                      </td>
                    </tr>
                  ) : !pppoeFilteredUsers.length ? (
                    <tr>
                      <td colSpan="9" className="text-center py-5 text-muted">
                        <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                        <p className="mb-0">No data found matching your filters</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((u, i) => {
                      const globalIndex = (currentPage - 1) * itemsPerPage + i + 1;
                      const isAnimating = animatingRows[u.username];
                      return (
                        <tr 
                          key={String(u.id)} 
                          className={`${u.isOnline ? "" : "opacity-75"} ${isAnimating ? "row-animate" : ""}`}
                          style={{ transition: "background-color 0.3s ease, opacity 0.3s ease" }}
                        >
                          <td>{globalIndex}</td>
                          <td>
                            <div className="fw-medium text-body-emphasis">{u.username || "-"}</div>
                            {u.service && <small className="text-muted d-block">{u.service}</small>}
                          </td>
                          <td>
                            {u.disabled ? (
                              <span className="badge rounded-pill px-3 py-2 bg-secondary-subtle text-secondary-emphasis">
                                <i className="bi bi-slash-circle-fill me-1 text-secondary" style={{ fontSize: "0.6rem" }} />
                                Disabled
                              </span>
                            ) : (
                              <StatusBadge online={u.isOnline} />
                            )}
                          </td>
                          <td>
                            {(u.ip || u.remoteAddress) ? (
                              <a
                                href={`http://${u.ip || u.remoteAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-decoration-none"
                                title="Open IP in new tab"
                              >
                                <code className="small bg-light px-2 py-1 rounded text-primary">
                                  {u.ip || u.remoteAddress}
                                </code>
                              </a>
                            ) : (
                              <code className="small bg-light px-2 py-1 rounded text-muted">-</code>
                            )}
                          </td>
                          <td>
                            {u.isOnline ? (
                              <div>
                                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 small fw-semibold">
                                  <i className="bi bi-clock-fill me-1" />
                                  {u.uptime || "-"}
                                </span>
                                <span className="text-muted d-block mt-1" style={{ fontSize: "0.75rem" }}>Uptime</span>
                              </div>
                            ) : (
                              <div>
                                <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 small fw-semibold">
                                  <i className="bi bi-clock me-1" />
                                  {u.downtime || "-"}
                                </span>
                                <span className="text-muted d-block mt-1" style={{ fontSize: "0.75rem" }}>Downtime</span>
                              </div>
                            )}
                          </td>
                          <td className="text-end">
                            <span className="text-success fw-medium">{formatTraffic(u.rx)}</span>
                          </td>
                          <td className="text-end">
                            <span className="text-primary fw-medium">{formatTraffic(u.tx)}</span>
                          </td>
                          <td>
                            {u.latitude && u.longitude ? (
                              <a
                                href={`https://maps.google.com/?q=${u.latitude},${u.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-decoration-none small text-danger fw-medium"
                                title="Open in Google Maps"
                              >
                                <i className="bi bi-geo-alt-fill me-1"></i>
                                {parseFloat(u.latitude).toFixed(3)}, {parseFloat(u.longitude).toFixed(3)}
                              </a>
                            ) : (
                              <span className="text-muted small">-</span>
                            )}
                          </td>
                          
                          {/* ACTIONS: Reconnect Session Only */}
                          <td className="text-end">
                            <div className="d-flex justify-content-end gap-1">
                              <ActionButton
                                icon="arrow-clockwise"
                                title="Reconnect Session"
                                variant="info"
                                disabled={!u.isOnline}
                                onClick={() => handleReconnectUser(u)}
                                loading={actionLoading[`reconnect-${u.username}`]}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Bottom */}
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={pppoeFilteredUsers.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
            />
          </div>

        </div>

      </div>

      {/* Lightbox Modal */}
      {lightbox.isOpen && createPortal(
          <div 
              style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100vw',
                  height: '100vh',
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  zIndex: 100060,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none'
              }}
              onClick={() => setLightbox(prev => ({ ...prev, isOpen: false }))}
          >
              <button 
                  type="button" 
                  className="btn btn-link text-white shadow-none" 
                  style={{
                      position: 'absolute',
                      top: '20px',
                      right: '20px',
                      fontSize: '28px',
                      zIndex: 10000,
                      opacity: 0.8,
                      transition: 'opacity 0.2s',
                  }}
                  onClick={() => setLightbox(prev => ({ ...prev, isOpen: false }))}
              >
                  <i className="bi bi-x-lg"></i>
              </button>

              {lightbox.images.length > 1 && (
                  <button 
                      type="button" 
                      className="btn btn-link text-white shadow-none" 
                      style={{
                          position: 'absolute',
                          left: '20px',
                          fontSize: '36px',
                          zIndex: 10000,
                          opacity: 0.8,
                          transition: 'opacity 0.2s'
                      }}
                      onClick={(e) => {
                          e.stopPropagation();
                          setLightbox(prev => ({
                              ...prev,
                              index: (prev.index - 1 + prev.images.length) % prev.images.length
                          }));
                      }}
                  >
                      <i className="bi bi-chevron-left"></i>
                  </button>
              )}

              <div 
                  style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      maxWidth: '90%',
                      maxHeight: '80%'
                  }}
                  onClick={(e) => e.stopPropagation()}
              >
                  <img 
                      src={lightbox.images[lightbox.index]} 
                      alt={`Foto ke-${lightbox.index + 1}`} 
                      className="img-fluid rounded-3 shadow-lg"
                      style={{
                          maxHeight: '75vh',
                          maxWidth: '100%',
                          objectFit: 'contain',
                          border: '3px solid rgba(255, 255, 255, 0.15)'
                      }}
                  />
                  
                  <div 
                      className="mt-3 px-3 py-1 rounded-pill text-white fw-bold"
                      style={{
                          backgroundColor: 'rgba(0, 0, 0, 0.6)',
                          fontSize: '14px',
                          backdropFilter: 'blur(4px)',
                          WebkitBackdropFilter: 'blur(4px)'
                      }}
                  >
                      {lightbox.index + 1} / {lightbox.images.length}
                  </div>
              </div>

              {lightbox.images.length > 1 && (
                  <button 
                      type="button" 
                      className="btn btn-link text-white shadow-none" 
                      style={{
                          position: 'absolute',
                          right: '20px',
                          fontSize: '36px',
                          zIndex: 10000,
                          opacity: 0.8,
                          transition: 'opacity 0.2s'
                      }}
                      onClick={(e) => {
                          e.stopPropagation();
                          setLightbox(prev => ({
                              ...prev,
                              index: (prev.index + 1) % prev.images.length
                          }));
                      }}
                  >
                      <i className="bi bi-chevron-right"></i>
                  </button>
              )}
          </div>,
          document.body
      )}

      {/* CUSTOM ALERT MODAL */}
      {customAlert.show && createPortal(
        <div className="custom-modal-backdrop d-flex align-items-center justify-content-center" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 100070 }}>
          <div className="custom-modal-card p-4 rounded-4 shadow-lg bg-body text-body border" style={{ width: '400px', maxWidth: '90%', animation: 'scaleUp 0.15s ease-out' }}>
            <div className="d-flex align-items-center gap-2 mb-3">
              <i className={`bi ${customAlert.type === 'danger' ? 'bi-exclamation-triangle-fill text-danger' : 'bi-info-circle-fill text-primary'} fs-4`}></i>
              <h4 className="m-0 fw-bold">{customAlert.title}</h4>
            </div>
            <p className="mb-4 text-secondary small" style={{ whiteSpace: 'pre-line' }}>{customAlert.message}</p>
            <div className="d-flex justify-content-end">
              <button className="btn btn-primary px-4 fw-semibold" onClick={() => setCustomAlert(prev => ({ ...prev, show: false }))}>OK</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* PORT DETAILS MODAL */}
      {portDetailNode && createPortal(
        <NodePortDetailModal
          show={!!portDetailNode}
          onClose={() => setPortDetailNode(null)}
          node={portDetailNode}
          isDarkMode={isDarkMode}
          nodes={nodes}
          oltPorts={oltPorts}
          pppoeUsers={pppoeUsers}
          onNavigateToEntity={handleNavigateToEntity}
        />,
        document.body
      )}

    </>
  );
}
