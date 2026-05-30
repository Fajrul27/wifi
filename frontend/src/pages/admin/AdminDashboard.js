import React, { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./AdminDashboard.css";
import L from "leaflet";
import api from "../../services/api";
import { socket } from "../../services/socket";
import { createCustomIcon, MARKER_CONFIG, isValidCoord } from "./utils/mapUtils";
import { FitMapBounds, MemoizedPolyline } from "./components/DashboardMapComponents";
import DashboardKpiCards from "./components/DashboardKpiCards";
import DashboardBandwidthChart from "./components/DashboardBandwidthChart";
import DashboardSystemLogs from "./components/DashboardSystemLogs";


export default function AdminDashboard({ 
  routers: propRouters = [], 
  oltPorts: propOltPorts = [], 
  nodes: propNodes = [], 
  splitters: propSplitters = [], 
  pppoeUsers: propUsers = [],
  selectedRouter: propSelectedRouter = null,
  onNodeClick = null,
  onOltPortClick = null
}) {
  // Jawa Tengah center as initial map position
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

  const [apiRouters, setApiRouters] = useState([]);
  const [apiOltPorts, setApiOltPorts] = useState([]);
  const [apiNodes, setApiNodes] = useState([]);
  const [apiUsers, setApiUsers] = useState([]);
  const [apiSelectedRouter, setApiSelectedRouter] = useState(null);
  // New UI states
  const [mapType, setMapType] = useState(() => {
    try { return sessionStorage.getItem('dashboard_map_type') || 'vector'; }
    catch(e) { return 'vector'; }
  }); // 'vector' or 'satellite'
  
  useEffect(() => {
    try { sessionStorage.setItem('dashboard_map_type', mapType); }
    catch(e) {}
  }, [mapType]);

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
  const [eventLogs, setEventLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isDeferredReady, setIsDeferredReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsDeferredReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const [bandwidthData, setBandwidthData] = useState(() => {
    try {
      const cached = sessionStorage.getItem("dashboard_bandwidth");
      if (cached) return JSON.parse(cached);
    } catch(e) {}
    return Array.from({ length: 20 }, (_, i) => ({
      time: new Date(Date.now() - (20 - i) * 3000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      download: 0,
      upload: 0
    }));
  });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const routersTrafficRef = useRef({});

  const isStandalone = propRouters.length === 0;

  const routers = isStandalone ? apiRouters : propRouters;
  const oltPorts = isStandalone ? apiOltPorts : propOltPorts;
  const nodes = isStandalone ? apiNodes : propNodes;
  const pppoeUsers = isStandalone ? apiUsers : propUsers;
  const selectedRouter = isStandalone ? apiSelectedRouter : propSelectedRouter;

  const addLogEvent = useCallback((message, type = 'info') => {
    setEventLogs(prev => {
      const newLogs = [{ id: Date.now(), time: new Date(), message, type }, ...prev];
      return newLogs.slice(0, 50); // keep last 50
    });
  }, []);

  useEffect(() => {
    if (!isStandalone) return;

    // Check cache first for instant load
    try {
      const cached = sessionStorage.getItem("dashboard_cache_base");
      const timestamp = sessionStorage.getItem("dashboard_cache_time");
      if (cached && timestamp && Date.now() - Number(timestamp) < 60000) { // 1 min cache
        const data = JSON.parse(cached);
        setApiRouters(data.routers || []);
        setApiNodes(data.nodes || []);
        if (data.logs?.length > 0) {
          setEventLogs(data.logs.map(log => ({
            ...log,
            time: new Date(log.time)
          })));
        }
        if (data.routers?.length > 0) {
          setApiSelectedRouter(prev => prev || data.routers[0].id);
        }
      }
    } catch(e) {}

    Promise.allSettled([
      api.get("/routers"),
      api.get("/topology"),
      api.get("/splitter"),
      api.get("/logs"),
    ]).then(([routerRes, nodesRes, splittersRes, logsRes]) => {
      const extractData = (res) => {
        if (res?.status !== 'fulfilled') return [];
        if (Array.isArray(res.value?.data?.data)) return res.value.data.data;
        if (Array.isArray(res.value?.data)) return res.value.data;
        return [];
      };

      const loadedRouters = extractData(routerRes);
      const loadedNodes = extractData(nodesRes);
      const loadedSplitters = extractData(splittersRes);
      const loadedLogsRaw = extractData(logsRes);
      
      const formattedLogs = loadedLogsRaw.length > 0 ? loadedLogsRaw.map(log => ({
          id: log.id,
          message: log.message,
          type: log.type,
          time: new Date(log.createdAt)
      })) : [];

      setApiRouters(loadedRouters);
      setApiNodes(loadedNodes);
      if (formattedLogs.length > 0) setEventLogs(formattedLogs);

      if (loadedRouters.length > 0) {
        setApiSelectedRouter(prev => prev || loadedRouters[0].id);
      }

      // Save to cache
      try {
        sessionStorage.setItem("dashboard_cache_base", JSON.stringify({
          routers: loadedRouters,
          nodes: loadedNodes,
          splitters: loadedSplitters,
          logs: formattedLogs
        }));
        sessionStorage.setItem("dashboard_cache_time", Date.now().toString());
      } catch(e) {}

    });
  }, [isStandalone, addLogEvent]);

  useEffect(() => {
    if (!isStandalone || !apiSelectedRouter) return;
    
    // Check cache first
    try {
      const cacheKey = `dashboard_cache_router_${apiSelectedRouter}`;
      const cached = sessionStorage.getItem(cacheKey);
      const timestamp = sessionStorage.getItem(`${cacheKey}_time`);
      if (cached && timestamp && Date.now() - Number(timestamp) < 60000) {
        const data = JSON.parse(cached);
        setApiOltPorts(data.oltPorts || []);
        setApiUsers(data.users || []);
        routersTrafficRef.current = {};
      }
    } catch(e) {}

    // Fetch router specific data when router changes
    const fetchRouterData = async () => {
      try {
        const [oltRes, usersRes] = await Promise.allSettled([
          api.get(`/olt-ports/router/${apiSelectedRouter}`),
          api.get(`/pppoe/${apiSelectedRouter}`)
        ]);
        
        const extractData = (res) => {
          if (res?.status !== 'fulfilled') return [];
          if (Array.isArray(res.value?.data?.data)) return res.value.data.data;
          if (Array.isArray(res.value?.data)) return res.value.data;
          return [];
        };
        
        const loadedOltPorts = extractData(oltRes);
        const loadedUsers = extractData(usersRes);

        setApiOltPorts(loadedOltPorts);
        setApiUsers(loadedUsers);
        
        // Save to cache
        try {
          const cacheKey = `dashboard_cache_router_${apiSelectedRouter}`;
          sessionStorage.setItem(cacheKey, JSON.stringify({
            oltPorts: loadedOltPorts,
            users: loadedUsers
          }));
          sessionStorage.setItem(`${cacheKey}_time`, Date.now().toString());
        } catch(e) {}

        // Also clear bandwidth data when router changes
        routersTrafficRef.current = {};
      } catch (err) {
        console.error("Failed to load router specific data", err);
      }
    };
    
    fetchRouterData();
  }, [isStandalone, apiSelectedRouter]);

  // Socket realtime
  useEffect(() => {
    if (!isStandalone || !selectedRouter) return;

    socket.emit("join-router", selectedRouter);

    const handleTopologyStatus = (data) => {
      // Logic for topology if needed, no longer generating local logs here
    };

    const handlePppoeRealtime = (data) => {
      const incoming = data?.data;
      if (!Array.isArray(incoming)) return;

      let sumRx = 0;
      let sumTx = 0;
      for (const r of incoming) {
          sumRx += Number(r.rxBps || 0);
          sumTx += Number(r.txBps || 0);
      }
      routersTrafficRef.current[data.routerId] = { rx: sumRx, tx: sumTx };

      if (Number(data?.routerId) !== Number(selectedRouter)) return;
      if (incoming.length === 0) return;

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

    const handleNewSystemLog = (log) => {
      setEventLogs(prev => {
        const newLog = {
          id: log.id,
          message: log.message,
          type: log.type,
          time: new Date(log.createdAt)
        };
        const updated = [newLog, ...prev].slice(0, 50);
        
        // Update session storage so logs survive navigation
        try {
          const cachedStr = sessionStorage.getItem("dashboard_cache_base");
          if (cachedStr) {
            const cached = JSON.parse(cachedStr);
            cached.logs = updated.map(l => ({
              ...l,
              time: l.time.toISOString ? l.time.toISOString() : new Date(l.time).toISOString()
            }));
            sessionStorage.setItem("dashboard_cache_base", JSON.stringify(cached));
          }
        } catch(e) {}

        return updated;
      });
    };

    socket.on("topology-status-realtime", handleTopologyStatus);
    socket.on("pppoe-realtime", handlePppoeRealtime);
    socket.on("new-system-log", handleNewSystemLog);

    return () => {
      socket.off("topology-status-realtime", handleTopologyStatus);
      socket.off("pppoe-realtime", handlePppoeRealtime);
      socket.off("new-system-log", handleNewSystemLog);
    };
  }, [isStandalone, selectedRouter]);

  const filteredOltPorts = useMemo(() => {
    return selectedRouter 
      ? oltPorts.filter(p => p.routerId === Number(selectedRouter))
      : oltPorts;
  }, [oltPorts, selectedRouter]);

  const filteredNodes = useMemo(() => {
    if (!selectedRouter) return nodes;
    const isNodeOnRouter = (node) => {
      if (node.oltPortId) {
        const port = oltPorts.find(p => p.id === node.oltPortId);
        return port?.routerId === Number(selectedRouter);
      }
      if (node.parentNodeId) {
        const parent = nodes.find(n => n.type === "ODC" && n.id === node.parentNodeId);
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
    return results.slice(0, 10);
  }, [searchTerm, filteredUsers, filteredNodes, routers]);

  // Real bandwidth data from socket (All Routers)
  useEffect(() => {
    const interval = setInterval(() => {
      setBandwidthData(prev => {
        const newData = [...prev.slice(1)];
        let totalRx = 0;
        let totalTx = 0;
        
        Object.values(routersTrafficRef.current).forEach(t => {
            totalRx += t.rx;
            totalTx += t.tx;
        });

        newData.push({
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          download: totalTx, // Router Transmit (TX) = Client Download
          upload: totalRx    // Router Receive (RX) = Client Upload
        });

        try {
          sessionStorage.setItem("dashboard_bandwidth", JSON.stringify(newData));
        } catch(e) {}
        
        return newData;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);



  const allCoordinates = useMemo(() => {
    if (!isDeferredReady) return [];
    const coords = [];
    routers.forEach(r => { if (isValidCoord(r.latitude, r.longitude)) coords.push({ lat: Number(r.latitude), lng: Number(r.longitude) }); });
    filteredOltPorts.forEach(p => { if (isValidCoord(p.latitude, p.longitude)) coords.push({ lat: Number(p.latitude), lng: Number(p.longitude) }); });
    filteredNodes.forEach(n => { if (isValidCoord(n.latitude, n.longitude)) coords.push({ lat: Number(n.latitude), lng: Number(n.longitude) }); });
    filteredUsers.forEach(u => { if (isValidCoord(u.latitude, u.longitude)) coords.push({ lat: Number(u.latitude), lng: Number(u.longitude) }); });
    return coords;
  }, [routers, filteredOltPorts, filteredNodes, filteredUsers, isDeferredReady]);

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

  const hasOnlineUser = useCallback((nodeId) => {
    const directUsers = filteredUsers.filter(u => u.topologyNodeId === nodeId);
    if (directUsers.some(u => u.isOnline)) return true;
    const childNodes = filteredNodes.filter(n => (n.incomingLinks?.[0]?.fromNodeId || n.parentNodeId) === nodeId);
    return childNodes.some(child => hasOnlineUser(child.id));
  }, [filteredUsers, filteredNodes]);

  const hasAnyUser = useCallback((nodeId) => {
    const directUsers = filteredUsers.filter(u => u.topologyNodeId === nodeId);
    if (directUsers.length > 0) return true;
    const childNodes = filteredNodes.filter(n => (n.incomingLinks?.[0]?.fromNodeId || n.parentNodeId) === nodeId);
    return childNodes.some(child => hasAnyUser(child.id));
  }, [filteredUsers, filteredNodes]);

  const connections = useMemo(() => {
    if (!showLines || !isDeferredReady) return [];
    const lines = [];

    filteredOltPorts.forEach(port => {
      const router = routers.find(r => r.id === port.routerId);
      if (isValidCoord(router?.latitude, router?.longitude) && isValidCoord(port.latitude, port.longitude)) {
        lines.push({
          id: `router-olt-${port.id}`,
          coordinates: port.roadCoordinates || [[Number(router.latitude), Number(router.longitude)], [Number(port.latitude), Number(port.longitude)]],
          type: 'router-to-olt',
          color: '#0ea5e9',
          weight: 4,
          animate: true,
          label: `Router ${router.name} ➔ OLT Port ${port.name}`
        });
      }
    });

    filteredNodes.filter(n => n.type === 'ODC' && n.oltPortId && !n.incomingLinks?.length && !n.parentNodeId).forEach(node => {
      const port = filteredOltPorts.find(p => p.id === node.oltPortId);
      if (isValidCoord(port?.latitude, port?.longitude) && isValidCoord(node.latitude, node.longitude)) {
        const anyUser = hasAnyUser(node.id);
        const isOnline = anyUser ? hasOnlineUser(node.id) : true;
        lines.push({
          id: `olt-${node.id}`,
          coordinates: node.roadCoordinates || [[Number(port.latitude), Number(port.longitude)], [Number(node.latitude), Number(node.longitude)]],
          type: 'olt-to-odc',
          color: !anyUser ? '#94a3b8' : (isOnline ? '#2563eb' : '#ef4444'),
          weight: !anyUser ? 3 : (isOnline ? 4 : 5),
          dashArray: !anyUser ? '4,4' : (isOnline ? undefined : '8,6'),
          animate: !anyUser ? false : isOnline,
          label: !anyUser ? `Feeder OLT ➔ ${node.name} (Kosong)` : (isOnline ? `Feeder OLT ➔ ${node.name}` : `⚠️ PUTUS: OLT ➔ ${node.name}`)
        });
      }
    });

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
          let lineDash = !anyUser ? '4,4' : (isOnline ? undefined : '8,6');

          lines.push({
            id: `node-${node.id}`,
            coordinates: node.roadCoordinates || [[Number(parent.latitude), Number(parent.longitude)], [Number(node.latitude), Number(node.longitude)]],
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

    if (showClients) {
        filteredUsers.forEach(user => {
        if (user.topologyNodeId) {
            const node = filteredNodes.find(n => n.id === user.topologyNodeId);
            if (isValidCoord(user.latitude, user.longitude) && isValidCoord(node?.latitude, node?.longitude) && node?.type === 'ODP') {
            const isUserOnline = user.isOnline;
            lines.push({
                id: `client-${user.id}`,
                coordinates: user.roadCoordinates || [[Number(node.latitude), Number(node.longitude)], [Number(user.latitude), Number(user.longitude)]],
                type: 'odp-to-client',
                color: isUserOnline ? '#10b981' : '#ef4444',
                weight: isUserOnline ? 3 : 4,
                dashArray: isUserOnline ? undefined : '6,6',
                animate: isUserOnline,
                label: `Drop: ${node.name} ➔ ${user.username}`
            });
            }
        }
        });
    }

    return lines;
  }, [filteredOltPorts, filteredNodes, filteredUsers, hasOnlineUser, hasAnyUser, routers, showLines, showClients, isDeferredReady]);

  const handleMarkerClick = useCallback((entity, type) => {
    if (mapInstance && entity.latitude && entity.longitude && isValidCoord(entity.latitude, entity.longitude)) {
      const targetLatLng = L.latLng(Number(entity.latitude), Number(entity.longitude));
      mapInstance.stop();
      
      const currentZoom = mapInstance.getZoom();
      const dist = mapInstance.getCenter().distanceTo(targetLatLng);
      
      if (dist < 500 && Math.abs(currentZoom - 18) <= 1) {
        mapInstance.setView(targetLatLng, 18, { animate: true, duration: 0.5 });
      } else {
        mapInstance.flyTo(targetLatLng, 18, { animate: true, duration: 1.2 });
      }
    }
    if (type === 'oltPort' && onOltPortClick) onOltPortClick(entity.id);
    else if (type === 'node' && onNodeClick) onNodeClick(entity.id);
   }, [onNodeClick, onOltPortClick, mapInstance]);

  const handleSearchSelect = (entity) => {
    setSearchTerm("");
    setShowSearchResults(false);
    if (!mapInstance || !isValidCoord(entity.latitude, entity.longitude)) return;
    handleMarkerClick(entity, entity._type);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      handleSearchSelect(searchResults[0]);
    } else {
      addLogEvent(`"${searchTerm}" not found.`, 'warning');
    }
  };


  const renderEntityPopup = (entity, type) => {
    const tKey = type === 'node' ? entity.type : type;
    const conf = MARKER_CONFIG[tKey] || MARKER_CONFIG.client;
    
    return (
        <Popup minWidth={260} autoPan={false} className={`custom-detail-popup ${isDarkMode ? 'dark-popup' : ''}`}>
            <div className="popup-header d-flex align-items-center gap-2">
                <div className="rounded-circle d-flex align-items-center justify-content-center text-white" style={{ width: '28px', height: '28px', background: conf.color || '#000', flexShrink: 0 }}>
                    <i className={`bi ${conf.icon}`} style={{ fontSize: '14px' }}></i>
                </div>
                <h6 className="mb-0 fw-bold text-truncate" style={{ fontSize: '14px' }}>{entity.name || entity.username}</h6>
            </div>
            <div className="popup-body mt-2" style={{ fontSize: '12px' }}>
                {type === 'router' && (
                    <div className="mb-2"><span className="text-muted d-block" style={{ fontSize: '11px' }}>Host</span><strong>{entity.host}</strong></div>
                )}
                {type === 'oltPort' && (
                    <div className="mb-2"><span className="text-muted d-block" style={{ fontSize: '11px' }}>Port</span><strong>{entity.port}</strong></div>
                )}
                {type === 'client' && (
                    <>
                        <div className="mb-2"><span className="text-muted d-block" style={{ fontSize: '11px' }}>IP Address</span><strong className="font-monospace">{entity.remoteAddress || '—'}</strong></div>
                        <div className="mb-2"><span className="text-muted d-block" style={{ fontSize: '11px' }}>Status</span><span className={`badge ${entity.isOnline ? 'bg-success' : 'bg-danger'}`}>{entity.isOnline ? 'Online' : 'Offline'}</span></div>
                    </>
                )}
                {type === 'node' && (
                    <>
                        <div className="mb-2"><span className="text-muted d-block" style={{ fontSize: '11px' }}>Type</span><span className={`badge ${entity.type === 'ODP' ? 'bg-warning text-dark' : 'bg-success'}`}>{entity.type}</span></div>
                        {entity.description && <div className="mb-2"><span className="text-muted d-block" style={{ fontSize: '11px' }}>Details</span><span>{entity.description}</span></div>}
                        {hasAnyUser(entity.id) && !hasOnlineUser(entity.id) && <div className="mb-2"><span className="badge bg-danger">Offline</span></div>}
                    </>
                )}
                {entity.latitude && (
                    <a href={`https://maps.google.com/?q=${entity.latitude},${entity.longitude}`} target="_blank" rel="noreferrer" className={`btn btn-sm w-100 mt-2 fw-medium border ${isDarkMode ? 'btn-dark text-info border-secondary' : 'btn-light text-primary'}`} style={{ fontSize: '12px' }}>
                        Open in Google Maps <i className="bi bi-box-arrow-up-right ms-1"></i>
                    </a>
                )}
            </div>
        </Popup>
    );
  };

  const renderMarkers = () => {
    if (!isDeferredReady) return [];
    const markers = [];
    if (showNodes) {
        routers.forEach(router => {
        if (!isValidCoord(router.latitude, router.longitude)) return;
        markers.push(
            <Marker key={`router-${router.id}`} position={[Number(router.latitude), Number(router.longitude)]} icon={createCustomIcon(MARKER_CONFIG.router.color, MARKER_CONFIG.router.icon)} eventHandlers={{ click: () => handleMarkerClick(router, 'router') }}>
                {renderEntityPopup(router, 'router')}
            </Marker>
        );
        });

        filteredOltPorts.forEach(port => {
        if (!isValidCoord(port.latitude, port.longitude)) return;
        markers.push(
            <Marker key={`olt-${port.id}`} position={[Number(port.latitude), Number(port.longitude)]} icon={createCustomIcon(MARKER_CONFIG.oltPort.color, MARKER_CONFIG.oltPort.icon)} eventHandlers={{ click: () => handleMarkerClick(port, 'oltPort') }}>
                {renderEntityPopup(port, 'oltPort')}
            </Marker>
        );
        });

        filteredNodes.forEach(node => {
        if (!isValidCoord(node.latitude, node.longitude)) return;
        const config = node.type === 'ODP' ? MARKER_CONFIG.ODP : MARKER_CONFIG.ODC;
        const anyUser = hasAnyUser(node.id);
        const isFaulty = anyUser && !hasOnlineUser(node.id);
        const markerColor = isFaulty ? '#ef4444' : config.color;

        markers.push(
            <Marker key={`node-${node.id}`} position={[Number(node.latitude), Number(node.longitude)]} icon={createCustomIcon(markerColor, config.icon, isFaulty)} eventHandlers={{ click: () => handleMarkerClick(node, 'node') }}>
                {renderEntityPopup(node, 'node')}
            </Marker>
        );
        });
    }

    if (showClients) {
        filteredUsers.forEach(user => {
        if (!user.topologyNodeId || !isValidCoord(user.latitude, user.longitude)) return;
        const isOnline = user.isOnline;
        const markerColor = isOnline ? '#10b981' : '#ef4444';
        markers.push(
            <Marker key={`client-${user.id}`} position={[Number(user.latitude), Number(user.longitude)]} icon={createCustomIcon(markerColor, MARKER_CONFIG.client.icon, !isOnline)} eventHandlers={{ click: () => handleMarkerClick(user, 'client') }}>
                {renderEntityPopup(user, 'client')}
            </Marker>
        );
        });
    }

    return markers;
  };

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

  return (
    <div className="container-fluid p-3 bg-body-secondary d-flex flex-column" style={{ height: '100vh', overflow: 'hidden', transition: 'background-color 0.3s' }}>
      
      {/* Dashboard Header */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-shrink-0">
        <div>
          <h3 className="fw-bold mb-1 text-body-emphasis" style={{ letterSpacing: '-0.5px' }}>Network Operations Center</h3>
          <p className="text-muted mb-0 small">Real-time monitoring for FTTH topology and PPPoE clients</p>
        </div>
        <div className="d-flex gap-2 align-items-center">
            {isStandalone && routers.length > 0 && (
                <div className="d-flex align-items-center bg-body border shadow-sm rounded-pill px-3 py-1 me-2">
                    <i className="bi bi-hdd-network text-primary me-2"></i>
                    <select 
                        className="form-select form-select-sm border-0 shadow-none bg-transparent fw-medium" 
                        value={selectedRouter || ''} 
                        onChange={(e) => setApiSelectedRouter(e.target.value)}
                        style={{ width: 'auto', minWidth: '130px', cursor: 'pointer', paddingLeft: 0, boxShadow: 'none', outline: 'none' }}
                    >
                        {routers.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
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
        <div className={isFullScreen ? "position-fixed top-0 start-0 end-0 bottom-0 bg-white" : "col-lg-9 col-xl-9 h-100"} style={isFullScreen ? { zIndex: 99999, margin: 0, padding: 0 } : {}}>
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
                          <div className="position-absolute top-100 start-0 w-100 mt-1 rounded-3 overflow-hidden shadow-lg search-dropdown" style={{ zIndex: 9999 }}>
                            {searchResults.map((item) => (
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
                                <label className="form-check-label small fw-medium">Show Clients</label>
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
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                ref={setMapInstance}
                preferCanvas={true}
            >
                {mapType === 'vector' ? (
                    <>
                        <TileLayer
                            key="light-tile"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                            maxZoom={20}
                            opacity={isDarkMode ? 0 : 1}
                        />
                        <TileLayer
                            key="dark-tile"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            maxZoom={20}
                            opacity={isDarkMode ? 1 : 0}
                        />
                    </>
                ) : (
                    <TileLayer
                        attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
                        url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                        maxZoom={22}
                        subdomains={['mt0','mt1','mt2','mt3']}
                    />
                )}
                
                {connections.map(line => (
                  <MemoizedPolyline 
                      key={`${line.id}-${line.color}`}
                      coordinates={line.coordinates}
                      color={line.color}
                      weight={line.weight}
                      dashArray={line.dashArray}
                      label={line.label}
                  />
                ))}
                
                {renderMarkers()}
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


          </div>
        </div>

        {/* Side Panel: Charts & Logs */}
        <div className="col-lg-3 col-xl-3 h-100 d-flex flex-column gap-3" style={isFullScreen ? { display: 'none' } : {}}>
          <DashboardBandwidthChart bandwidthData={bandwidthData} isDarkMode={isDarkMode} />
          <DashboardSystemLogs eventLogs={eventLogs} />
        </div>
      </div>
    </div>
  );
}