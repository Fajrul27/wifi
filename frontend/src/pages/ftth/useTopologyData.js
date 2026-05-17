import { useState, useCallback, useEffect, useMemo } from "react";
import api from "../../services/api";
import { socket } from "../../services/socket";
import { extractDataArray } from "./topologyUtils";

export function useTopologyData() {
  const [loading, setLoading] = useState(false);
  const [selectedRouter, setSelectedRouter] = useState(null);
  const [selectedOltPort, setSelectedOltPort] = useState(null);

  // Data entities
  const [routers, setRouters] = useState([]);
  const [oltPorts, setOltPorts] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [splitters, setSplitters] = useState([]);
  const [pppoeUsers, setPppoeUsers] = useState([]);
  const [realtimeTopology, setRealtimeTopology] = useState([]);
  const [scanResults, setScanResults] = useState([]);
  const [scanning, setScanning] = useState(false);

  /* ───────────────── LOAD DATA ───────────────── */
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [routerRes, oltRes, nodesRes, splittersRes, usersRes] = await Promise.allSettled([
        api.get("/routers"),
        selectedRouter ? api.get(`/olt-ports/router/${selectedRouter}`) : Promise.resolve({ data: { data: [] } }),
        api.get("/topology"),
        api.get("/splitter"),
        selectedRouter ? api.get(`/pppoe/${selectedRouter}`) : Promise.resolve({ data: { data: [] } }),
      ]);

      setRouters(extractDataArray(routerRes.status === 'fulfilled' ? routerRes.value : null));
      setOltPorts(extractDataArray(oltRes.status === 'fulfilled' ? oltRes.value : null));
      setNodes(extractDataArray(nodesRes.status === 'fulfilled' ? nodesRes.value : null));
      setSplitters(extractDataArray(splittersRes.status === 'fulfilled' ? splittersRes.value : null));
      setPppoeUsers(extractDataArray(usersRes.status === 'fulfilled' ? usersRes.value : null));

      const routerList = extractDataArray(routerRes.status === 'fulfilled' ? routerRes.value : null);
      if (routerList.length > 0 && !selectedRouter) {
        setSelectedRouter(routerList[0].id);
      }
    } catch (err) {
      console.error("Failed to load topology data:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedRouter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 🔌 Socket realtime — update langsung dari payload tanpa API call
  useEffect(() => {
    if (!selectedRouter) return;

    // ─── Update status topologi node (warna kabel) ───
    const handleTopologyStatus = (data) => {
      if (Number(data?.routerId) !== Number(selectedRouter)) return;
      if (data && Array.isArray(data.data)) {
        setRealtimeTopology(data.data);
      } else if (Array.isArray(data)) {
        setRealtimeTopology(data);
      }
    };

    // ─── Update status user PPPoE LANGSUNG dari socket (tanpa API call) ───
    const handlePppoeRealtime = (data) => {
      if (Number(data?.routerId) !== Number(selectedRouter)) return;
      const incoming = data?.data;
      if (!Array.isArray(incoming) || incoming.length === 0) return;

      setPppoeUsers((prev) => {
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
  }, [selectedRouter]);

  /* ───────────────── FILTERED DATA & STATS ───────────────── */
  const provisioningStats = useMemo(() => {
    const totalPorts = splitters.reduce((acc, s) => acc + (s.outputPort || 0), 0);
    const usedPorts = splitters.reduce((acc, s) => acc + (s.outputs?.filter(o => o.isUsed).length || 0), 0);
    const unassignedCount = pppoeUsers.filter(u => !u.topologyNodeId).length;
    const mismatchedUsers = pppoeUsers.filter(u => u.isOnline && !u.topologyNodeId);

    return {
      totalPorts,
      usedPorts,
      availablePorts: totalPorts - usedPorts,
      unassignedUsers: unassignedCount,
      mismatchedUsers,
      utilization: totalPorts > 0 ? Math.round((usedPorts / totalPorts) * 100) : 0,
    };
  }, [splitters, pppoeUsers]);

  const filteredOltPorts = useMemo(() => 
    selectedRouter ? oltPorts.filter(p => p.routerId === Number(selectedRouter)) : oltPorts
  , [oltPorts, selectedRouter]);

  const filteredNodes = useMemo(() => 
    selectedOltPort ? nodes.filter(n => n.oltPortId === selectedOltPort) : nodes
  , [nodes, selectedOltPort]);

  const availableUsers = useMemo(() => 
    pppoeUsers.filter(u => !u.topologyNodeId)
  , [pppoeUsers]);

  const stats = useMemo(() => ({
    odcCount: nodes.filter(n => n.type === 'ODC').length,
    odpCount: nodes.filter(n => n.type === 'ODP').length,
    assignedUsers: pppoeUsers.filter(u => u.topologyNodeId).length,
    splitterCount: splitters.length,
    activePorts: filteredOltPorts.length,
  }), [nodes, pppoeUsers, splitters, filteredOltPorts]);

  return {
    loading, setLoading,
    selectedRouter, setSelectedRouter,
    selectedOltPort, setSelectedOltPort,
    routers, oltPorts, nodes, splitters, pppoeUsers,
    realtimeTopology, scanResults, setScanResults,
    scanning, setScanning,
    loadData,
    provisioningStats, filteredOltPorts, filteredNodes, availableUsers, stats,
  };
}
