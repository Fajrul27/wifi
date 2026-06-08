import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import api from "../services/api";
import { socket } from "../services/socket";

const GlobalRealtimeContext = createContext(null);

const hasRouteCoordinates = (value) => {
  if (!value) return false;
  if (Array.isArray(value)) return value.length >= 2;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) && parsed.length >= 2;
    } catch {
      return false;
    }
  }
  return Array.isArray(value?.coordinates) && value.coordinates.length >= 2;
};

const mergeWithExistingRoutes = (incoming = [], existing = []) => {
  const existingMap = new Map(existing.map((item) => [`${item.type || ""}:${item.id}`, item]));

  return incoming.map((item) => {
    const key = `${item.type || ""}:${item.id}`;
    const old = existingMap.get(key) || existing.find((x) => Number(x.id) === Number(item.id));

    if (!hasRouteCoordinates(item.roadCoordinates) && hasRouteCoordinates(old?.roadCoordinates)) {
      return {
        ...item,
        roadCoordinates: old.roadCoordinates,
      };
    }

    return item;
  });
};

const clearDashboardSessionCache = () => {
  try {
    Object.keys(sessionStorage).forEach((key) => {
      if (
        key === "last_selected_router_id" ||
        key === "dashboard_cache_time" ||
        key === "dashboard_cache_base" ||
        key.startsWith("dashboard_cache_router_") ||
        key.startsWith("dashboard_map_center_") ||
        key.startsWith("dashboard_map_zoom_")
      ) {
        sessionStorage.removeItem(key);
      }
    });
  } catch {}
};

/* ─────────────────────────────
   SAFE NUMBER
───────────────────────────── */
const toNumber = (v) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

/* ─────────────────────────────
   STRICT TRAFFIC NORMALIZER
───────────────────────────── */
const normalizeTraffic = (v) => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? 0 : n;
  }
  if (typeof v === "object") {
    return toNumber(
      v.rxRaw ??
      v.txRaw ??
      v.value ??
      v.bps ??
      0
    );
  }
  return 0;
};

export function GlobalRealtimeProvider({ children }) {
  const location = useLocation();
  const isLoginPage = location.pathname === "/";

  const [routers, setRouters] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [oltPorts, setOltPorts] = useState([]);
  const [pppoeUsers, setPppoeUsers] = useState([]);
  const [eventLogs, setEventLogs] = useState([]);
  const [selectedRouter, setSelectedRouter] = useState(() => {
    if (localStorage.getItem("lock_router") === "true") {
      const saved = localStorage.getItem("locked_router_id");
      if (saved) return Number(saved);
    }
    const sessionSaved = sessionStorage.getItem("last_selected_router_id");
    if (sessionSaved) return Number(sessionSaved);
    return null;
  });

  useEffect(() => {
    if (selectedRouter) {
      sessionStorage.setItem("last_selected_router_id", selectedRouter);
    }
  }, [selectedRouter]);

  const [isRouterLocked, setIsRouterLocked] = useState(
    () => localStorage.getItem("lock_router") === "true"
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const routersTrafficRef = useRef({});

  const addLogEvent = useCallback((message, type = "info") => {
    setEventLogs((prev) => {
      const newLogs = [{ id: Date.now(), time: new Date(), message, type }, ...prev];
      return newLogs.slice(0, 100);
    });
  }, []);

  /* ─────────────────────────────
     ROUTER MONITOR REALTIME STATES & WS
  ───────────────────────────── */
  const [monitorSocketConnected, setMonitorSocketConnected] = useState(false);
  const [isRouterConnected, setIsRouterConnected] = useState(false);
  const [metrics, setMetrics] = useState({
    labels: [],
    cpuData: [],
    ramData: [],
    rxData: [],
    txData: [],
    latest: { cpu: 0, ram: 0, rx: 0, tx: 0 },
  });

  // Sync initial isRouterConnected state from routers array when selectedRouter changes
  useEffect(() => {
    if (selectedRouter && routers.length > 0) {
      const activeRouter = routers.find((r) => Number(r.id) === Number(selectedRouter));
      if (activeRouter) {
        setIsRouterConnected(!!activeRouter.isOnline);
      } else {
        setIsRouterConnected(false);
      }
    } else {
      setIsRouterConnected(false);
    }
  }, [selectedRouter, routers]);

  // Reset metrics when selectedRouter changes to prevent displaying stale metrics of the previous router
  useEffect(() => {
    setMetrics({
      labels: [],
      cpuData: [],
      ramData: [],
      rxData: [],
      txData: [],
      latest: { cpu: 0, ram: 0, rx: 0, tx: 0 },
    });
  }, [selectedRouter]);

  // Connect/disconnect socket based on whether we are on the login page
  useEffect(() => {
    if (isLoginPage) {
      if (socket.connected) {
        socket.disconnect();
      }
      return;
    }

    if (!socket.connected) {
      socket.connect();
    }
  }, [isLoginPage]);

  // Raw WebSocket connection to router realtime on port 5050
  useEffect(() => {
    if (isLoginPage || !selectedRouter) return;

    let ws;
    let reconnect;

    const connect = () => {
      const wsUrl = (process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost') 
        ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/`
        : `ws://localhost:${process.env.REACT_APP_WS_PORT || 5050}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setMonitorSocketConnected(true);
        try {
          ws.send(JSON.stringify({ type: "join", routerId: selectedRouter }));
        } catch (e) {}
      };

      ws.onclose = () => {
        setMonitorSocketConnected(false);
        reconnect = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        // Let browser handle closing naturally
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (Number(msg.routerId) !== Number(selectedRouter)) return;

          if (msg.type === "router-realtime") {
            setIsRouterConnected(true);

            const s = msg.data?.system || {};
            const t = msg.data?.traffic || {};

            const time = new Date().toLocaleTimeString();

            const rx = normalizeTraffic(
              t.rxRaw ?? t.rx ?? t.rxBps ?? 0
            );

            const tx = normalizeTraffic(
              t.txRaw ?? t.tx ?? t.txBps ?? 0
            );

            const cpu = toNumber(s.cpuLoad);

            const ram =
              s.totalMemory && s.freeMemory
                ? ((s.totalMemory - s.freeMemory) / s.totalMemory) * 100
                : toNumber(s.ramUsage ?? s.ram ?? 0);

            const limit = 720; // 1h limit

            setMetrics((prev) => ({
              labels: [...prev.labels, time].slice(-limit),
              cpuData: [...prev.cpuData, cpu].slice(-limit),
              ramData: [...prev.ramData, ram].slice(-limit),
              rxData: [...prev.rxData, rx].slice(-limit),
              txData: [...prev.txData, tx].slice(-limit),
              latest: {
                cpu,
                ram,
                rx,
                tx,
              },
            }));
          } else if (msg.type === "router-status") {
            setIsRouterConnected(!!msg.data?.isOnline);
          }
        } catch (e) {
          console.error("WS ERROR:", e);
        }
      };
    };

    connect();

    return () => {
      clearTimeout(reconnect);
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          try {
            ws.close();
          } catch (e) {}
        }
      }
    };
  }, [selectedRouter, isLoginPage]);

  // ─── Load Base Data (routers, nodes) once on mount or when navigating away from login page ───────────────────────
  const [isBaseFetched, setIsBaseFetched] = useState(false);

  useEffect(() => {
    if (isLoginPage) {
      // Clear data and state on login page (e.g. on logout)
      clearDashboardSessionCache();
      setIsInitialized(false);
      setIsBaseFetched(false);
      setRouters([]);
      setNodes([]);
      setOltPorts([]);
      setPppoeUsers([]);
      setEventLogs([]);
      setSelectedRouter(null);
      return;
    }

    if (isBaseFetched) return;
    setIsBaseFetched(true);

    // Try session cache first
    try {
      const cached = sessionStorage.getItem("dashboard_cache_base");
      const ts = sessionStorage.getItem("dashboard_cache_time");
      if (cached && ts && Date.now() - Number(ts) < 300000) { // 5 min cache
        const data = JSON.parse(cached);
        if (data.routers?.length > 0) {
          setRouters(data.routers);
          setNodes(data.nodes || []);
          setEventLogs(
            (data.logs || []).map((l) => ({ ...l, time: new Date(l.time) }))
          );
          setSelectedRouter((prev) => prev || data.routers[0].id);
          setIsInitialized(true);
        }
      }
    } catch (e) {}

    Promise.allSettled([
      api.get("/routers"),
      api.get("/topology"),
      api.get("/logs"),
    ]).then(([routerRes, nodesRes, logsRes]) => {
      const extract = (res) => {
        if (res?.status !== "fulfilled") return [];
        if (Array.isArray(res.value?.data?.data)) return res.value.data.data;
        if (Array.isArray(res.value?.data)) return res.value.data;
        return [];
      };

      const loadedRouters = extract(routerRes);
      const loadedNodes = extract(nodesRes);
      const loadedLogsRaw = extract(logsRes);

      const formattedLogs = loadedLogsRaw.map((log) => ({
        id: log.id,
        message: log.message,
        type: log.type,
        time: new Date(log.createdAt),
      }));

      if (loadedRouters.length > 0) {
        setRouters(loadedRouters);
        setSelectedRouter((prev) => prev || loadedRouters[0].id);
      }
      if (loadedNodes.length > 0) setNodes(loadedNodes);
      if (formattedLogs.length > 0) setEventLogs(formattedLogs);
      setIsInitialized(true);

      // Update cache
      try {
        sessionStorage.setItem(
          "dashboard_cache_base",
          JSON.stringify({ routers: loadedRouters, nodes: loadedNodes, logs: formattedLogs })
        );
        sessionStorage.setItem("dashboard_cache_time", Date.now().toString());
      } catch (e) {}
    });
  }, [isLoginPage, isBaseFetched]);

  // ─── Load Router-Specific Data (oltPorts, users) when selectedRouter changes ───
  useEffect(() => {
    if (isLoginPage) return;

    if (!selectedRouter) {
      const fetchAllOltPorts = async () => {
        try {
          const res = await api.get("/olt-ports");
          const loadedOltPorts = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
          setOltPorts(loadedOltPorts);
        } catch (err) {
          console.error("Failed to load all OLT ports", err);
        }
      };
      fetchAllOltPorts();
      return;
    }

    // Try cache first
    try {
      const cacheKey = `dashboard_cache_router_${selectedRouter}`;
      const cached = sessionStorage.getItem(cacheKey);
      const ts = sessionStorage.getItem(`${cacheKey}_time`);
      if (cached && ts && Date.now() - Number(ts) < 60000) { // 1 min cache
        const data = JSON.parse(cached);
        setOltPorts(data.oltPorts || []);
        setPppoeUsers(data.users || []);
        routersTrafficRef.current = {};
      }
    } catch (e) {}

    const fetchRouterData = async () => {
      try {
        const [oltRes, usersRes] = await Promise.allSettled([
          api.get(`/olt-ports/router/${selectedRouter}`),
          api.get(`/pppoe/${selectedRouter}`),
        ]);

        const extract = (res) => {
          if (res?.status !== "fulfilled") return [];
          if (Array.isArray(res.value?.data?.data)) return res.value.data.data;
          if (Array.isArray(res.value?.data)) return res.value.data;
          return [];
        };

        const loadedOltPorts = extract(oltRes);
        const loadedUsers = extract(usersRes);

        setOltPorts(loadedOltPorts);
        setPppoeUsers(loadedUsers);
        routersTrafficRef.current = {};

        try {
          const cacheKey = `dashboard_cache_router_${selectedRouter}`;
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({ oltPorts: loadedOltPorts, users: loadedUsers })
          );
          sessionStorage.setItem(`${cacheKey}_time`, Date.now().toString());
        } catch (e) {}
      } catch (err) {
        console.error("Failed to load router data", err);
      }
    };

    fetchRouterData();
  }, [selectedRouter, isLoginPage]);

  // ─── Socket: join router room ─────────────────────────────────────────────
  useEffect(() => {
    if (isLoginPage || !selectedRouter) return;
    socket.emit("join-router", selectedRouter);
    return () => {
      socket.emit("leave-router", selectedRouter);
    };
  }, [selectedRouter, isLoginPage]);

  // ─── Socket: pppoe-realtime ───────────────────────────────────────────────
  useEffect(() => {
    if (isLoginPage) return;
    const handlePppoeRealtime = (data) => {
      const incoming = data?.data;
      if (!Array.isArray(incoming)) return;

      // Accumulate traffic per router
      let sumRx = 0, sumTx = 0;
      for (const r of incoming) {
        sumRx += Number(r.rxBps || 0);
        sumTx += Number(r.txBps || 0);
      }
      routersTrafficRef.current[data.routerId] = { rx: sumRx, tx: sumTx };

      if (Number(data?.routerId) !== Number(selectedRouter)) return;
      if (incoming.length === 0) return;

      setPppoeUsers((prev) => {
        const map = new Map(prev.map((u) => [u.id, u]));
        for (const r of incoming) {
          const old = map.get(r.id) || {};
          map.set(r.id, {
            ...old,
            id: r.id,
            routerId: r.routerId ?? old.routerId,
            username: r.username ?? old.username,
            isOnline: !!r.isOnline,
            profile: r.profile ?? old.profile ?? "-",
            // Use ?? to preserve null/empty string from new data, only fallback to old if undefined
            remoteAddress: r.remoteAddress !== undefined ? r.remoteAddress : old.remoteAddress ?? null,
            localAddress: r.localAddress !== undefined ? r.localAddress : old.localAddress ?? null,
            uptime: r.isOnline ? (r.uptime ?? null) : null,
            lastSeen: r.lastSeen ?? old.lastSeen,
            lastDisconnect: r.lastDisconnect ?? old.lastDisconnect,
            rx: r.isOnline ? (r.rxBps ?? 0) : 0,
            tx: r.isOnline ? (r.txBps ?? 0) : 0,
            latitude: r.latitude !== undefined ? r.latitude : old.latitude,
            longitude: r.longitude !== undefined ? r.longitude : old.longitude,
            topologyNodeId: r.topologyNodeId !== undefined ? r.topologyNodeId : old.topologyNodeId,
            roadCoordinates: r.roadCoordinates !== undefined ? r.roadCoordinates : old.roadCoordinates,
            whatsapp: r.whatsapp !== undefined ? r.whatsapp : old.whatsapp,
            address: r.address !== undefined ? r.address : old.address,
            imagePath: r.imagePath !== undefined ? r.imagePath : old.imagePath,
          });
        }
        return Array.from(map.values());
      });
    };

    socket.on("pppoe-realtime", handlePppoeRealtime);
    return () => socket.off("pppoe-realtime", handlePppoeRealtime);
  }, [selectedRouter, isLoginPage]);

  // ─── Socket: topology-status-realtime ────────────────────────────────────
  useEffect(() => {
    if (isLoginPage) return;
    const handleTopologyStatus = (data) => {
      if (data?.nodes) {
        setNodes((prev) => mergeWithExistingRoutes(data.nodes, prev));
      }
      if (data?.oltPorts) {
        setOltPorts((prev) => {
          const merged = mergeWithExistingRoutes(data.oltPorts, prev);
          if (!selectedRouter) return merged;

          const routerIdNum = Number(selectedRouter);
          return merged.filter((p) => Number(p.routerId) === routerIdNum);
        });
      }
    };

    socket.on("topology-status-realtime", handleTopologyStatus);
    return () => socket.off("topology-status-realtime", handleTopologyStatus);
  }, [isLoginPage, selectedRouter]);

  // ─── Socket: new-system-log ───────────────────────────────────────────────
  useEffect(() => {
    if (isLoginPage) return;
    const handleNewSystemLog = (log) => {
      if (!log?.message) return;
      setEventLogs((prev) => {
        const updated = [
          { id: log.id || Date.now(), message: log.message, type: log.type || "info", time: new Date(log.time || Date.now()) },
          ...prev,
        ].slice(0, 100);
        // Sync to session cache
        try {
          const cached = JSON.parse(sessionStorage.getItem("dashboard_cache_base") || "{}");
          cached.logs = updated.map((l) => ({
            ...l,
            time: l.time?.toISOString ? l.time.toISOString() : new Date(l.time).toISOString(),
          }));
          sessionStorage.setItem("dashboard_cache_base", JSON.stringify(cached));
        } catch (e) {}
        return updated;
      });
    };

    socket.on("new-system-log", handleNewSystemLog);
    return () => socket.off("new-system-log", handleNewSystemLog);
  }, [isLoginPage]);

  return (
    <GlobalRealtimeContext.Provider
      value={{
        routers,
        setRouters,
        nodes,
        setNodes,
        oltPorts,
        setOltPorts,
        pppoeUsers,
        setPppoeUsers,
        eventLogs,
        setEventLogs,
        selectedRouter,
        setSelectedRouter,
        isRouterLocked,
        setIsRouterLocked,
        isInitialized,
        routersTrafficRef,
        addLogEvent,
        monitorSocketConnected,
        isRouterConnected,
        metrics,
      }}
    >
      {children}
    </GlobalRealtimeContext.Provider>
  );
}

export function useGlobalRealtime() {
  const ctx = useContext(GlobalRealtimeContext);
  if (!ctx) throw new Error("useGlobalRealtime must be used inside GlobalRealtimeProvider");
  return ctx;
}
