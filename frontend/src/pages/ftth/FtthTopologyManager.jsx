import React, { useEffect, useState, useMemo, useCallback } from "react";
import api from "../../services/api";
import { socket } from "../../services/socket";
import MapPicker from "../../components/MapPicker";
import OltPortManager from "./components/OltPortManager";
import TopologyTreeView from "./components/TopologyTreeView";
import PppoeManager from "./components/PppoeManager";
import TopologyFlowChart from "./components/TopologyFlowChart";

export default function FtthTopologyManager() {
  /* ───────────────── STATE ───────────────── */
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTab, setSelectedTab] = useState("olt-ports");

  // Data entities
  const [routers, setRouters] = useState([]);
  const [oltPorts, setOltPorts] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [splitters, setSplitters] = useState([]);
  const [pppoeUsers, setPppoeUsers] = useState([]);
  const [realtimeTopology, setRealtimeTopology] = useState([]); // Data realtime dari socket
  const [scanResults, setScanResults] = useState([]); // Hasil scan interface
  const [scanning, setScanning] = useState(false);

  // Configuration constants
  const CABLE_TYPES = {
    'DROP_1_CORE': 1, 'BACKBONE_1_CORE': 1, 'BACKBONE_2_CORE': 2,
    'BACKBONE_4_CORE': 4, 'BACKBONE_6_CORE': 6, 'BACKBONE_8_CORE': 8,
    'BACKBONE_12_CORE': 12, 'BACKBONE_24_CORE': 24, 'BACKBONE_32_CORE': 32,
    'BACKBONE_64_CORE': 64, 'BACKBONE_96_CORE': 96,
  };

  const SPLITTER_TYPES = {
    'NONE': 0, 'SPLITTER_1_2': 2, 'SPLITTER_1_4': 4, 'SPLITTER_1_8': 8,
    'SPLITTER_1_16': 16, 'SPLITTER_1_32': 32, 'SPLITTER_1_64': 64,
  };

  // Selection state
  const [selectedRouter, setSelectedRouter] = useState(null);
  const [selectedOltPort, setSelectedOltPort] = useState(null);

  // Modal states (centralized)
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteType, setDeleteType] = useState(null);
  const [modalData, setModalData] = useState(null);

  // Custom UI Notifications
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [confirm, setConfirm] = useState({ show: false, message: "", onConfirm: null });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const showConfirm = (message, onConfirm) => {
    setConfirm({ show: true, message, onConfirm });
  };

  // Form states
  const [oltPortForm, setOltPortForm] = useState({
    id: null, name: "", port: "", routerId: "", latitude: "", longitude: ""
  });
  const [nodeForm, setNodeForm] = useState({
    id: null, name: "", type: "ODC", oltPortId: "", parentNodeId: "",
    latitude: "", longitude: "", description: "", cableType: "BACKBONE_12_CORE",
    totalCore: 12, distanceMeter: ""
  });
  const [splitterForm, setSplitterForm] = useState({
    nodeId: "", type: "SPLITTER_1_8", outputPort: 8, name: "", description: ""
  });
  const [assignForm, setAssignForm] = useState({ 
    outputId: "", clientId: "", targetNodeId: "" 
  });
  const [userForm, setUserForm] = useState({
    id: "", username: "", latitude: "", longitude: ""
  });
  const [userSearch, setUserSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);

  /* ───────────────── API HELPERS ───────────────── */
  const extractDataArray = (response) => {
    if (!response?.data) return [];
    if (Array.isArray(response.data.data)) return response.data.data;
    if (Array.isArray(response.data)) return response.data;
    return [];
  };

  /* ───────────────── LOAD DATA ───────────────── */
  const loadData = useCallback(async (silent = false) => {
    // Hanya tampilkan loading indicator saat pertama kali (bukan saat background refresh)
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



  useEffect(() => { loadData(); }, [loadData]);

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
    // Ini yang membuat Visual Chart, PPPoE Users, dsb update realtime tanpa kedipan
    const handlePppoeRealtime = (data) => {
      if (Number(data?.routerId) !== Number(selectedRouter)) return;
      const incoming = data?.data;
      if (!Array.isArray(incoming) || incoming.length === 0) return;

      setPppoeUsers((prev) => {
        // Buat map dari data lama berdasarkan id
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

  /* ───────────────── HELPERS ───────────────── */
  const getRouterName = (id) => routers.find(r => r.id === id)?.name || `Router #${id}`;

  const getCableLabel = (type) => {
    const map = {
      'DROP_1_CORE': 'Drop 1 Core', 'BACKBONE_1_CORE': 'Backbone 1 Core',
      'BACKBONE_2_CORE': '2 Core', 'BACKBONE_4_CORE': '4 Core',
      'BACKBONE_6_CORE': '6 Core', 'BACKBONE_8_CORE': '8 Core',
      'BACKBONE_12_CORE': '12 Core', 'BACKBONE_24_CORE': '24 Core',
      'BACKBONE_32_CORE': '32 Core', 'BACKBONE_64_CORE': '64 Core',
      'BACKBONE_96_CORE': '96 Core',
    };
    return map[type] || type;
  };

  const getSplitterLabel = (type) => {
    const map = {
      'NONE': 'No Splitter', 'SPLITTER_1_2': '1:2', 'SPLITTER_1_4': '1:4',
      'SPLITTER_1_8': '1:8', 'SPLITTER_1_16': '1:16', 'SPLITTER_1_32': '1:32',
      'SPLITTER_1_64': '1:64',
    };
    return map[type] || type;
  };

  const formatCoord = (val) => val ? parseFloat(val).toFixed(4) : '-';

  // Helper hitung jarak GPS (meter)
  const getDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c);
  };

  /* ───────────────── FILTERED DATA ───────────────── */
  const provisioningStats = useMemo(() => {
    const totalPorts = splitters.reduce((acc, s) => acc + (s.outputPort || 0), 0);
    const usedPorts = splitters.reduce((acc, s) => acc + (s.outputs?.filter(o => o.isUsed).length || 0), 0);
    const unassignedCount = pppoeUsers.filter(u => !u.topologyNodeId).length;
    
    // Deteksi pelanggan yang Online tapi belum di-assign ke port (Mismatch)
    const mismatchedUsers = pppoeUsers.filter(u => u.isOnline && !u.topologyNodeId);
    
    return {
      totalPorts,
      usedPorts,
      availablePorts: totalPorts - usedPorts,
      unassignedUsers: unassignedCount,
      mismatchedUsers,
      utilization: totalPorts > 0 ? Math.round((usedPorts / totalPorts) * 100) : 0
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

  /* ───────────────── MODAL HANDLERS ───────────────── */
  const openModal = (type, data = null) => {
    setModalType(type);
    setModalData(data);
    
    if (type === 'oltPort') {
      setOltPortForm({
        id: data?.id || null, name: data?.name || '', port: data?.port || '',
        routerId: data?.routerId || selectedRouter || '',
        latitude: data?.latitude ?? '', longitude: data?.longitude ?? '',
      });
    }
    if (type === 'node') {
      const parentLink = data?.incomingLinks?.[0] || null;
      const parentId = parentLink?.fromNodeId || data?.parentNodeId || '';
      let pNode = nodes.find(n => Number(n.id) === Number(parentId));
      let oltId = data?.oltPortId || pNode?.oltPortId || '';

      // Jika pNode.oltPortId kosong, telusuri ke atas melalui incomingLinks / parentNodeId sampai ketemu oltPortId
      let curr = pNode;
      while (!oltId && curr) {
        const nextParentId = curr.incomingLinks?.[0]?.fromNodeId || curr.parentNodeId;
        if (!nextParentId) break;
        curr = nodes.find(n => Number(n.id) === Number(nextParentId));
        oltId = curr?.oltPortId || '';
      }

      setNodeForm({
        id: data?.id || null, name: data?.name || '', type: data?.type || 'ODC',
        oltPortId: oltId, parentNodeId: parentId,
        latitude: data?.latitude ?? '', longitude: data?.longitude ?? '',
        description: data?.description || '', cableType: parentLink?.cableType || 'BACKBONE_12_CORE',
        totalCore: parentLink?.totalCore || 12, distanceMeter: parentLink?.distanceMeter ?? '',
      });
    }
    if (type === 'splitter') {
      setSplitterForm({
        nodeId: data?.nodeId || '', type: data?.type || 'SPLITTER_1_8',
        outputPort: data?.outputPort || 8, name: data?.name || '', description: data?.description || '',
      });
    }
    if (type === 'assign') {
      setAssignForm({
        outputId: data?.outputId || '', clientId: data?.clientId || '', targetNodeId: data?.targetNodeId || '', assignType: 'client', showExistingNodeSelect: false
      });
      setUserSearch('');
      setClientDropdownOpen(false);
    }
    if (type === 'editUser') {
      setUserForm({
        id: data.id,
        username: data.username,
        latitude: data.latitude || "",
        longitude: data.longitude || ""
      });
    }
    setShowModal(true);
  };

  // 🎯 Auto-Select Port Terdekat saat User dipilih di Modal Assign
  useEffect(() => {
    if (modalType === 'assign' && assignForm.clientId) {
      const selectedUser = pppoeUsers.find(u => Number(u.id) === Number(assignForm.clientId));
      if (selectedUser?.latitude && !assignForm.outputId) {
        // Cari port terdekat
        const options = splitters.flatMap(s => {
          const node = nodes.find(n => Number(n.id) === Number(s.nodeId));
          const dist = getDistance(selectedUser.latitude, selectedUser.longitude, node?.latitude, node?.longitude);
          return (s.outputs || []).filter(o => !o.isUsed).map(o => ({ id: o.id, distance: dist }));
        });

        if (options.length > 0) {
          options.sort((a, b) => a.distance - b.distance);
          setAssignForm(prev => ({ ...prev, outputId: options[0].id.toString() }));
        }
      }
    }
  }, [modalType, assignForm.clientId, assignForm.outputId, pppoeUsers, splitters, nodes]);

  const closeModal = () => {
    setShowModal(false);
    setModalType(null);
    setModalData(null);
    setUserSearch('');
    setClientDropdownOpen(false);
  };

  /* ───────────────── SUBMIT HANDLERS ───────────────── */
  const submitOltPort = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        routerId: Number(oltPortForm.routerId), name: oltPortForm.name, port: oltPortForm.port,
        latitude: oltPortForm.latitude !== '' ? parseFloat(oltPortForm.latitude) : null,
        longitude: oltPortForm.longitude !== '' ? parseFloat(oltPortForm.longitude) : null,
      };
      let res;
      if (oltPortForm.id) res = await api.put(`/olt-ports/${oltPortForm.id}`, payload);
      else res = await api.post("/olt-ports", payload);
      if (res.data && res.data.success === false) throw new Error(res.data.message || "Gagal menyimpan OLT Port");
      await loadData();
      closeModal();
      showToast("OLT Port berhasil disimpan!", "success");
    } catch (err) {
      showToast("Gagal: " + (err.response?.data?.message || err.message), "danger");
    } finally { setSubmitting(false); }
  };

  const submitNode = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: nodeForm.name, type: nodeForm.type,
        oltPortId: nodeForm.oltPortId ? Number(nodeForm.oltPortId) : null,
        parentNodeId: nodeForm.parentNodeId ? Number(nodeForm.parentNodeId) : null,
        latitude: nodeForm.latitude !== '' ? parseFloat(nodeForm.latitude) : null,
        longitude: nodeForm.longitude !== '' ? parseFloat(nodeForm.longitude) : null,
        description: nodeForm.description || null,
        cableType: nodeForm.parentNodeId ? nodeForm.cableType : undefined,
        totalCore: nodeForm.parentNodeId ? Number(nodeForm.totalCore) : undefined,
        distanceMeter: nodeForm.parentNodeId && nodeForm.distanceMeter !== '' ? Number(nodeForm.distanceMeter) : undefined,
      };
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
      let res;
      if (nodeForm.id) {
        res = await api.put(`/topology/${nodeForm.id}`, payload);
      } else {
        if (payload.type === 'ODP' && !payload.parentNodeId) {
          throw new Error("Pilih 'Parent Node (ODC)' sebagai sumber kabel untuk ODP ini.");
        }
        res = await api.post("/topology", payload);
      }
      if (res.data && res.data.success === false) {
        throw new Error(res.data.message || "Gagal menyimpan node");
      }
      await loadData();
      closeModal();
      showToast("Node berhasil disimpan!", "success");
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      showToast("⚠️ Gagal menyimpan: " + msg, "danger");
    } finally { setSubmitting(false); }
  };

  const submitSplitter = async (e) => {
    e.preventDefault();
    if (!splitterForm.nodeId) {
      showToast("Pilih node terlebih dahulu!", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        nodeId: Number(splitterForm.nodeId), type: splitterForm.type,
        outputPort: Number(splitterForm.outputPort),
        name: splitterForm.name || null, description: splitterForm.description || null,
      };
      const res = await api.post("/splitter", payload);
      if (res.data && res.data.success === false) throw new Error(res.data.message || "Gagal menyimpan splitter");
      const splitterId = res.data?.data?.id;
      if (splitterId) await api.post(`/splitter/${splitterId}/generate`);
      await loadData();
      closeModal();
      showToast("Splitter berhasil disimpan!", "success");
    } catch (err) {
      showToast("Gagal: " + (err.response?.data?.message || err.message), "danger");
    } finally { setSubmitting(false); }
  };

  const submitAssign = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        targetNodeId: assignForm.assignType === 'node' && assignForm.targetNodeId ? Number(assignForm.targetNodeId) : null,
        clientId: assignForm.assignType === 'client' && assignForm.clientId ? Number(assignForm.clientId) : null,
      };
      const res = await api.put(`/splitter/output/${assignForm.outputId}/assign`, payload);
      if (res.data && res.data.success === false) throw new Error(res.data.message || "Gagal memasang pelanggan");
      await loadData();
      closeModal();
      showToast("Pelanggan berhasil dipasang ke port!", "success");
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      showToast("⚠️ Gagal memasang pelanggan: " + msg, "danger");
    } finally { setSubmitting(false); }
  };

  const handleUnassignClient = async (clientId) => {
    const targetId = Number(clientId);
    const user = pppoeUsers.find(u => Number(u.id) === targetId);
    
    showConfirm(`Yakin ingin MEMUTUS layanan untuk ${user?.username || 'pelanggan ini'}?\n\nJalur kabel akan dilepas dan internet di Mikrotik akan otomatis DIMATIKAN.`, async () => {
      setLoading(true);
      try {
        let targetOutputId = null;
        
        // 1. Cari lokal dulu
        for (const s of splitters) {
          const found = (s.outputs || []).find(o => o.isUsed && Number(o.clientId) === targetId);
          if (found) { targetOutputId = found.id; break; }
        }
        
        // 2. Jika tidak ada di lokal, tanya database (Sync Fallback)
        if (!targetOutputId) {
          const res = await api.get(`/splitter/output/client/${targetId}`);
          if (res.data?.data?.id) {
            targetOutputId = res.data.data.id;
          }
        }
        
        if (!targetOutputId) {
          showConfirm("Jalur kabel fisik tidak ditemukan di database (Data Mismatch).\n\nIngin RESET PAKSA status pelanggan ini agar bisa dipasang ulang dari awal?", async () => {
            try {
              setLoading(true);
              await api.post(`/splitter/user/${targetId}/force-reset`);
              await loadData();
              showToast("Status pelanggan berhasil direset paksa.", "success");
            } catch (err) {
              showToast("Gagal reset: " + err.message, "danger");
            } finally { setLoading(false); }
          });
          return;
        }

        await api.put(`/splitter/output/${targetOutputId}/unassign`);
        await loadData();
        showToast(`Layanan ${user?.username} berhasil diputus.`, "success");
      } catch (err) {
        showToast("Gagal memutus: " + (err.response?.data?.message || err.message), "danger");
      } finally { setLoading(false); }
    });
  };

  const handleUnassignPort = async (outputId) => {
    let output = null;
    for (const s of splitters) {
      const found = (s.outputs || []).find(o => Number(o.id) === Number(outputId));
      if (found) { output = found; break; }
    }

    const label = output?.client?.username ? `pelanggan ${output.client.username}` : output?.targetNode?.name ? `node lanjutan [${output.targetNode.type}] ${output.targetNode.name}` : `port #${output?.portNumber || outputId}`;

    showConfirm(`Yakin ingin MEMUTUS jalur koneksi pada ${label}?\n\nJika ini adalah pelanggan, akses internet di Mikrotik akan otomatis DIMATIKAN.`, async () => {
      setLoading(true);
      try {
        await api.put(`/splitter/output/${outputId}/unassign`);
        await loadData();
        showToast(`Jalur koneksi pada ${label} berhasil diputus.`, "success");
      } catch (err) {
        showToast("Gagal memutus: " + (err.response?.data?.message || err.message), "danger");
      } finally { setLoading(false); }
    });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/pppoe/location/${userForm.id}`, {
        latitude: parseFloat(userForm.latitude),
        longitude: parseFloat(userForm.longitude)
      });
      await loadData();
      closeModal();
      showToast("Lokasi pelanggan berhasil diperbarui!", "success");
    } catch (err) {
      showToast("Gagal update lokasi: " + (err.response?.data?.message || err.message), "danger");
    } finally { setSubmitting(false); }
  };

  const scanInterfaces = async () => {
    if (!selectedRouter) return;
    setScanning(true);
    setScanResults([]);
    try {
      const res = await api.get(`/olt-ports/router/${selectedRouter}/scan`);
      setScanResults(res.data?.data || []);
      if (res.data?.data?.length === 0) {
        showToast("Tidak ada interface baru yang ditemukan pada router ini.", "info");
      }
    } catch (err) {
      showToast("Gagal scan: " + (err.response?.data?.message || err.message), "danger");
    } finally {
      setScanning(false);
    }
  };

  const addScannedPort = async (iface) => {
    try {
      await api.post("/olt-ports", {
        routerId: selectedRouter,
        name: iface.name,
        port: iface.name,
      });
      setScanResults(prev => prev.filter(p => p.name !== iface.name));
      await loadData();
      showToast(`Port ${iface.name} berhasil ditambahkan!`, "success");
    } catch (err) {
      showToast("Gagal menambah port: " + (err.response?.data?.message || err.message), "danger");
    }
  };

  const confirmDelete = async () => {
    try {
      let res;
      if (deleteType === 'oltPort') res = await api.delete(`/olt-ports/${deleteId}`);
      else if (deleteType === 'node') res = await api.delete(`/topology/${deleteId}`);
      else if (deleteType === 'splitter') res = await api.delete(`/splitter/${deleteId}`);
      
      if (res?.data && res.data.success === false) {
        throw new Error(res.data.message || "Gagal menghapus item");
      }

      setDeleteId(null);
      setDeleteType(null);
      await loadData();
      showToast("Item berhasil dihapus!", "success");
    } catch (err) {
      showToast("Gagal menghapus: " + (err.response?.data?.message || err.message), "danger");
    }
  };

  /* ───────────────── STATUS BADGE ───────────────── */
  const StatusBadge = ({ online }) => (
    <span className={`badge rounded-pill px-3 py-2 border ${online ? "bg-success-subtle text-success border-success-subtle" : "bg-secondary-subtle text-secondary border-secondary-subtle"}`}>
      <i className={`bi bi-circle-fill me-1 ${online ? "text-success" : "text-secondary"}`} style={{ fontSize: "0.6rem" }}></i>
      {online ? "Online" : "Offline"}
    </span>
  );

  /* ───────────────── RENDER ───────────────── */
  return (
    <div className="container-fluid py-4" style={{ background: "#f8f9fa", minHeight: "100vh" }}>
      
      {/* ===== HEADER ===== */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h3 className="fw-bold mb-1 text-dark">
            <i className="bi bi-diagram-3-fill me-2 text-primary"></i>FTTH Topology Manager
          </h3>
          <p className="text-muted mb-0 small">Router → OLT Port → ODC → ODP → Splitter → Client</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1" onClick={loadData} disabled={loading}>
            <i className={`bi bi-arrow-clockwise ${loading ? 'spinner-border spinner-border-sm' : ''}`}></i> 
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <span className="badge bg-light text-dark border px-3 py-2">
            <i className="bi bi-hdd-network me-1"></i>
            {stats.activePorts} Ports • {stats.odcCount} ODC • {stats.odpCount} ODP • {stats.assignedUsers} Clients
          </span>
        </div>
      </div>

      {/* ===== ROUTER SELECTOR ===== */}
      <div className="card border shadow-sm mb-4">
        <div className="card-body py-3">
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label small text-muted fw-semibold mb-1">Active Router</label>
              <select className="form-select form-select-sm" value={selectedRouter || ""} onChange={(e) => setSelectedRouter(Number(e.target.value))}>
                {routers.map((r) => (<option key={r.id} value={r.id}>{r.name} {r.host ? `(${r.host})` : ""}</option>))}
              </select>
            </div>
            <div className="col-md-8 d-flex gap-2 justify-content-md-end">
              <button className="btn btn-primary btn-sm" onClick={() => openModal('oltPort')}><i className="bi bi-plus-lg me-1"></i> Add OLT Port</button>
              <button className="btn btn-success btn-sm" onClick={() => openModal('node')}><i className="bi bi-diagram-2 me-1"></i> Add Node</button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== ALERT: MISMATCHED USERS (Online tapi belum Mapping) ===== */}
      {provisioningStats.mismatchedUsers.length > 0 && (
        <div className="alert alert-danger border-0 shadow-sm mb-4 d-flex align-items-center justify-content-between">
          <div>
            <i className="bi bi-exclamation-octagon-fill me-2"></i>
            <strong>Deteksi Otomatis:</strong> Ada <strong>{provisioningStats.mismatchedUsers.length} pelanggan</strong> sudah Online (kabel sudah dicolok) tapi belum terdata di port ODP!
            <div className="small mt-1 opacity-75">
              Pelanggan: {provisioningStats.mismatchedUsers.map(u => u.username).join(', ')}
            </div>
          </div>
          <button 
            className="btn btn-danger btn-sm fw-bold"
            onClick={() => {
              setSelectedTab('pppoe');
              showToast("Silakan klik tombol 'Pasang' pada user yang berlabel NEW dan Online untuk mendata posisi kabelnya.", "info");
            }}
          >
            Data Sekarang
          </button>
        </div>
      )}

      {/* ===== PROVISIONING SUMMARY ===== */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card border-0 shadow-sm bg-primary text-white h-100">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="small opacity-75">Total Port Fiber</div>
                  <h4 className="mb-0 fw-bold">{provisioningStats.totalPorts}</h4>
                </div>
                <i className="bi bi-diagram-3 fs-3 opacity-50"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm bg-success text-white h-100">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="small opacity-75">Port Tersedia</div>
                  <h4 className="mb-0 fw-bold">{provisioningStats.availablePorts}</h4>
                </div>
                <i className="bi bi-check-circle fs-3 opacity-50"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm bg-warning text-dark h-100">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="small opacity-75">Baru (Belum Pasang)</div>
                  <h4 className="mb-0 fw-bold">{provisioningStats.unassignedUsers}</h4>
                </div>
                <i className="bi bi-person-plus fs-3 opacity-50"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm bg-white border h-100">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <div className="small text-muted fw-semibold">Utilisasi Jaringan</div>
                <span className={`badge ${provisioningStats.utilization > 90 ? 'bg-danger' : 'bg-primary'} bg-opacity-10 text-${provisioningStats.utilization > 90 ? 'danger' : 'primary'}`}>
                  {provisioningStats.utilization}%
                </span>
              </div>
              <div className="progress" style={{height: "8px"}}>
                <div className={`progress-bar bg-${provisioningStats.utilization > 90 ? 'danger' : 'primary'}`} style={{width: `${provisioningStats.utilization}%`}}></div>
              </div>
              <div className="small text-muted mt-2" style={{fontSize: "0.7rem"}}>
                {provisioningStats.usedPorts} port terpakai dari {provisioningStats.totalPorts}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== TABS NAVIGATION ===== */}
      <ul className="nav nav-pills mb-4 border-bottom pb-2">
        {[
          { id: 'olt-ports', label: '🔌 OLT Ports', count: filteredOltPorts.length, icon: 'hdd-stack' },
          { id: 'topology', label: '🗺️ Topology', count: filteredNodes.length, icon: 'diagram-2' },
          { id: 'chart', label: '📊 Visual Chart', count: '', icon: 'bar-chart-steps' },
          { id: 'pppoe', label: '👥 PPPoE Users', count: pppoeUsers.length, icon: 'people' },
        ].map(tab => (
          <li className="nav-item me-2" key={tab.id}>
            <button 
              className={`nav-link d-flex align-items-center gap-2 px-3 py-2 ${selectedTab === tab.id ? 'active fw-semibold' : 'text-muted'}`}
              onClick={() => setSelectedTab(tab.id)}
              style={{ borderRadius: '8px', background: selectedTab === tab.id ? '#0d6efd' : 'transparent', color: selectedTab === tab.id ? '#fff' : '#212529', transition: 'all 0.2s ease' }}
            >
              <i className={`bi bi-${tab.icon}`}></i>{tab.label}
              <span className={`badge rounded-pill ${selectedTab === tab.id ? 'bg-light text-primary' : 'bg-light text-dark'}`}>{tab.count}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* ===== TAB CONTENT ===== */}
      {selectedTab === 'olt-ports' && (
        <>
          <div className="mb-3 d-flex gap-2">
            <button className="btn btn-outline-primary btn-sm" onClick={scanInterfaces} disabled={scanning}>
              {scanning ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-search me-1"></i>}
              Scan Interface Mikrotik
            </button>
          </div>

          {scanResults.length > 0 && (
            <div className="alert alert-info border-0 shadow-sm mb-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0 fw-bold"><i className="bi bi-cpu me-2"></i>Interface Baru Terdeteksi</h6>
                <button className="btn-close" onClick={() => setScanResults([])}></button>
              </div>
              <div className="d-flex flex-wrap gap-2">
                {scanResults.map(p => (
                  <div key={p.name} className="badge bg-white text-dark border p-2 d-flex align-items-center gap-2 shadow-sm">
                    <span>{p.name} <small className="text-muted">({p.type})</small></span>
                    <button className="btn btn-primary btn-sm py-0 px-2" onClick={() => addScannedPort(p)} style={{fontSize: '0.65rem'}}>+ Add</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <OltPortManager 
            loading={loading}
            oltPorts={filteredOltPorts}
            nodes={nodes}
            routers={routers}
            onEdit={(port) => openModal('oltPort', port)}
            onDelete={(id) => { setDeleteId(id); setDeleteType('oltPort'); }}
            onAddNode={(oltPortId) => openModal('node', { type: 'ODC', oltPortId })}
            onViewTopology={(portId) => { setSelectedOltPort(portId); setSelectedTab('topology'); }}
            formatCoord={formatCoord}
            getRouterName={getRouterName}
            StatusBadge={StatusBadge}
          />
        </>
      )}

      {selectedTab === 'topology' && (
        <div className="card border shadow-sm">
          <div className="card-header bg-white border-bottom py-3">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <h5 className="mb-0 fw-semibold text-dark">
                <i className="bi bi-diagram-2 me-2 text-primary" />Topology Network
                <span className="badge bg-secondary ms-2">{filteredNodes.length}</span>
              </h5>
              <div className="d-flex gap-2">
                <button className="btn btn-success btn-sm" onClick={() => openModal('node')}>
                  <i className="bi bi-plus-lg me-1" /> Add Node
                </button>
              </div>
            </div>
          </div>
          <div className="card-body">
            <TopologyTreeView
              nodes={nodes}
              oltPorts={filteredOltPorts}
              splitters={splitters}
              realtimeTopology={realtimeTopology}
              onEdit={(node) => openModal('node', node)}
              onDelete={(id) => { setDeleteId(id); setDeleteType('node'); }}
              onAddChild={(parentId, type) => openModal('node', { type, parentNodeId: parentId })}
              onAddSplitter={(nodeId) => openModal('splitter', { nodeId })}
              onAssignClient={(id) => {
                const isOutput = splitters.some(s => (s.outputs || []).some(o => Number(o.id) === Number(id)));
                if (isOutput) {
                  openModal('assign', { outputId: id });
                } else {
                  openModal('assign', { targetNodeId: id });
                }
              }}
              onUnassignPort={handleUnassignPort}
            />
          </div>
        </div>
      )}

      {selectedTab === 'chart' && (
        <TopologyFlowChart 
          nodes={nodes}
          splitters={splitters}
          oltPorts={filteredOltPorts}
          pppoeUsers={pppoeUsers}
          realtimeTopology={realtimeTopology}
          routers={routers}
          selectedRouter={selectedRouter}
        />
      )}

      {selectedTab === 'pppoe' && (
        <PppoeManager 
          users={pppoeUsers}
          nodes={nodes}
          availableUsers={availableUsers}
          onAssign={(userId) => openModal('assign', { clientId: userId })}
          onUnassign={handleUnassignClient}
          onEditLocation={(user) => openModal('editUser', user)}
          formatCoord={formatCoord}
          StatusBadge={StatusBadge}
        />
      )}

      {/* ========================= SHARED MODAL ========================= */}
      {showModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 1050 }} onClick={closeModal}>
          <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white" style={{ maxHeight: "90vh" }}>
              <div className="modal-header bg-light py-3 px-4 border-bottom border-secondary-subtle d-flex align-items-center justify-content-between">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2 fs-5">
                  <div className="bg-primary bg-opacity-10 text-primary p-2 rounded-3 d-flex align-items-center justify-content-center">
                    <i className={`bi bi-${modalType === 'oltPort' ? 'hdd-stack' : modalType === 'node' ? 'diagram-2' : modalType === 'splitter' ? 'diagram-3' : modalType === 'editUser' ? 'geo-alt' : 'person-plus'}`}></i>
                  </div>
                  {modalType === 'oltPort' ? (oltPortForm.id ? 'Edit' : 'Add') + ' OLT Port' :
                   modalType === 'node' ? (nodeForm.id ? 'Edit ' : 'Add ') + (modalData?.parentNodeId && nodeForm.type === 'ODC' ? 'Sub-ODC (Optical Distribution Cabinet)' : nodeForm.type === 'ODP' ? 'ODP (Optical Distribution Point)' : 'ODC (Optical Distribution Cabinet)') :
                   modalType === 'splitter' ? 'Add Fiber Splitter' : 
                   modalType === 'editUser' ? 'Set Customer Location' : 'Assign Client to Fiber'}
                </h5>
                <button type="button" className="btn-close bg-secondary bg-opacity-10 p-2 rounded-circle shadow-none" onClick={closeModal}></button>
              </div>

              <form onSubmit={
                modalType === 'oltPort' ? submitOltPort : 
                modalType === 'node' ? submitNode : 
                modalType === 'splitter' ? submitSplitter : 
                modalType === 'editUser' ? handleUpdateUser :
                submitAssign
              } className="d-flex flex-column overflow-hidden" style={{ flex: 1 }}>
                <div className="modal-body p-4 overflow-y-auto">
                  {/* OLT PORT FORM */}
                  {modalType === 'oltPort' && (
                    <>
                      <h6 className="text-muted text-uppercase fw-bold mb-3 small tracking-wider"><i className="bi bi-plug me-2 text-primary"></i>Pengaturan Port OLT</h6>
                      <div className="row g-3 mb-4">
                        <div className="col-md-6">
                          <label className="form-label small fw-bold text-secondary mb-1">Router Mikrotik *</label>
                          <select className="form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none" required value={oltPortForm.routerId} onChange={(e) => setOltPortForm({ ...oltPortForm, routerId: e.target.value })}>
                            <option value="">Pilih Router</option>
                            {routers.map(r => <option key={r.id} value={r.id}>{r.name} • {r.host}</option>)}
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-bold text-secondary mb-1">Nama Port *</label>
                          <input className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none" placeholder="contoh: OLT PORT 1" value={oltPortForm.name} onChange={(e) => setOltPortForm({ ...oltPortForm, name: e.target.value })} required />
                        </div>
                        <div className="col-md-12">
                          <label className="form-label small fw-bold text-secondary mb-1">Interface GPON *</label>
                          <input className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none" placeholder="contoh: GPON0/1" value={oltPortForm.port} onChange={(e) => setOltPortForm({ ...oltPortForm, port: e.target.value })} required />
                        </div>
                      </div>
                      <h6 className="text-muted text-uppercase fw-bold mb-2 small tracking-wider"><i className="bi bi-geo-alt me-2 text-primary"></i>Koordinat Lokasi (Opsional)</h6>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <small className="text-muted"><i className="bi bi-hand-index me-1 text-primary"></i>Klik pada peta untuk menandai titik lokasi OLT Port</small>
                        {oltPortForm.latitude && oltPortForm.longitude && (
                          <button type="button" className="btn btn-sm btn-outline-danger rounded-3 py-1 px-2 shadow-sm" onClick={() => setOltPortForm(prev => ({ ...prev, latitude: '', longitude: '' }))}>
                            <i className="bi bi-x-circle me-1"></i> Hapus Pin
                          </button>
                        )}
                      </div>
                      <div className="rounded-4 overflow-hidden border border-secondary-subtle shadow-sm mb-2">
                        <MapPicker
                          key={`olt-map-${showModal}-${oltPortForm.id}`}
                          lat={oltPortForm.latitude}
                          lng={oltPortForm.longitude}
                          height={240}
                          onChange={(lat, lng) => setOltPortForm(prev => ({
                            ...prev,
                            latitude: lat === "" ? "" : Number(lat).toFixed(7),
                            longitude: lng === "" ? "" : Number(lng).toFixed(7),
                          }))}
                        />
                      </div>
                    </>
                  )}

                  {/* NODE FORM */}
                  {modalType === 'node' && (
                    <>
                      <div className="row g-3 mb-4">
                        <div className="col-md-6">
                          <label className="form-label small fw-bold text-secondary mb-1">Nama Node *</label>
                          <input className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none" placeholder="contoh: ODC-KOTA" value={nodeForm.name} onChange={(e) => setNodeForm({ ...nodeForm, name: e.target.value })} required />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-bold text-secondary mb-1">Tipe Node *</label>
                          <select 
                            className="form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none" 
                            required 
                            value={nodeForm.type} 
                            onChange={(e) => setNodeForm({ ...nodeForm, type: e.target.value })}
                          >
                            <option value="ODC">ODC (Optical Distribution Cabinet)</option>
                            <option value="ODP">ODP (Optical Distribution Point)</option>
                          </select>
                        </div>
                      </div>

                      {nodeForm.type === 'ODC' ? (
                        <div className="row g-3 mb-4 p-4 rounded-4 bg-primary bg-opacity-10 border border-primary-subtle shadow-sm">
                           <div className="col-12 mb-0">
                             <small className="text-primary fw-bold d-flex align-items-center gap-2 mb-1">
                               <i className="bi bi-hdd-network fs-5"></i> Sumber Jalur Fiber (OLT Port & Parent ODC)
                             </small>
                           </div>
                           <div className="col-md-6 mt-0">
                             <label className="form-label small fw-bold text-secondary mb-1">Ke OLT Port Utama *</label>
                             <select 
                               className={`form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none ${(!nodeForm.id && (modalData?.oltPortId || modalData?.parentNodeId || nodeForm.splitterOutputId) && nodeForm.oltPortId) ? 'bg-light' : ''}`} 
                               value={nodeForm.oltPortId} 
                               disabled={!nodeForm.id && (!!modalData?.oltPortId || !!modalData?.parentNodeId || !!nodeForm.splitterOutputId) && !!nodeForm.oltPortId}
                               onChange={(e) => setNodeForm({ ...nodeForm, oltPortId: e.target.value })} 
                               required
                             >
                               <option value="">— Pilih OLT Port —</option>
                               {filteredOltPorts.map(p => <option key={p.id} value={p.id}>{p.name} • {p.port}</option>)}
                             </select>
                             {!nodeForm.id && (!!modalData?.oltPortId || !!modalData?.parentNodeId || !!nodeForm.splitterOutputId) && !!nodeForm.oltPortId && (
                               <small className="text-success mt-1 d-flex align-items-center gap-1 fw-medium">
                                 <i className="bi bi-lock-fill"></i> Terkunci otomatis ke OLT Port utama
                               </small>
                             )}
                           </div>
                           <div className="col-md-6 mt-0">
                             <label className="form-label small fw-bold text-secondary mb-1">Ke Parent ODC (Sub-ODC)</label>
                             <select 
                               className={`form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none ${(!nodeForm.id && (modalData?.parentNodeId || nodeForm.splitterOutputId)) ? 'bg-light' : ''}`} 
                               value={nodeForm.parentNodeId} 
                               disabled={!nodeForm.id && (!!modalData?.parentNodeId || !!nodeForm.splitterOutputId)}
                               onChange={(e) => {
                                 const pId = e.target.value;
                                 const pNode = nodes.find(n => Number(n.id) === Number(pId));
                                 setNodeForm({ ...nodeForm, parentNodeId: pId, oltPortId: pNode?.oltPortId || nodeForm.oltPortId });
                               }}
                             >
                               <option value="">— Tidak Ada (Langsung OLT) —</option>
                               {nodes.filter(n => n.id !== nodeForm.id && n.type === 'ODC').map(n => <option key={n.id} value={n.id}>[{n.type}] {n.name}</option>)}
                             </select>
                             {!nodeForm.id && (!!modalData?.parentNodeId || !!nodeForm.splitterOutputId) && (
                               <small className="text-success mt-1 d-flex align-items-center gap-1 fw-medium">
                                 <i className="bi bi-lock-fill"></i> Terkunci otomatis ke Parent ODC sebagai sumber Sub-ODC
                               </small>
                             )}
                           </div>
                        </div>
                      ) : (
                        <div className="row g-3 mb-4 p-4 rounded-4 bg-warning bg-opacity-10 border border-warning-subtle shadow-sm">
                           <div className="col-12 mb-0">
                             <small className="text-warning-emphasis fw-bold d-flex align-items-center gap-2 mb-1">
                               <i className="bi bi-hdd-network fs-5"></i> Sumber Jalur Fiber (OLT Port & Parent ODC)
                             </small>
                           </div>
                           <div className="col-md-6 mt-0">
                             <label className="form-label small fw-bold text-secondary mb-1">OLT Port Utama *</label>
                             <select 
                               className={`form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none ${(!nodeForm.id && (modalData?.oltPortId || modalData?.parentNodeId || nodeForm.splitterOutputId) && nodeForm.oltPortId) ? 'bg-light' : ''}`} 
                               value={nodeForm.oltPortId} 
                               disabled={!nodeForm.id && (!!modalData?.oltPortId || !!modalData?.parentNodeId || !!nodeForm.splitterOutputId) && !!nodeForm.oltPortId}
                               onChange={(e) => setNodeForm({ ...nodeForm, oltPortId: e.target.value })} 
                               required
                             >
                               <option value="">— Pilih OLT Port —</option>
                               {filteredOltPorts.map(p => <option key={p.id} value={p.id}>{p.name} • {p.port}</option>)}
                             </select>
                             {!nodeForm.id && (!!modalData?.oltPortId || !!modalData?.parentNodeId || !!nodeForm.splitterOutputId) && !!nodeForm.oltPortId && (
                               <small className="text-success mt-1 d-flex align-items-center gap-1 fw-medium">
                                 <i className="bi bi-lock-fill"></i> Terkunci otomatis ke OLT Port utama
                               </small>
                             )}
                           </div>
                           <div className="col-md-6 mt-0">
                             <label className="form-label small fw-bold text-secondary mb-1">Parent Node (Sumber ODC) *</label>
                             <select 
                               className={`form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none ${(!nodeForm.id && (modalData?.parentNodeId || nodeForm.splitterOutputId)) ? 'bg-light' : ''}`} 
                               required 
                               value={nodeForm.parentNodeId} 
                               disabled={!nodeForm.id && (!!modalData?.parentNodeId || !!nodeForm.splitterOutputId)}
                               onChange={(e) => {
                                 const pId = e.target.value;
                                 const pNode = nodes.find(n => Number(n.id) === Number(pId));
                                 setNodeForm({ ...nodeForm, parentNodeId: pId, oltPortId: pNode?.oltPortId || nodeForm.oltPortId });
                               }}
                             >
                               <option value="">— Pilih Parent Node —</option>
                               {nodes.filter(n => n.id !== nodeForm.id && n.type === 'ODC').map(n => <option key={n.id} value={n.id}>[{n.type}] {n.name}</option>)}
                             </select>
                             {!nodeForm.id && (!!modalData?.parentNodeId || !!nodeForm.splitterOutputId) && (
                               <small className="text-success mt-1 d-flex align-items-center gap-1 fw-medium">
                                 <i className="bi bi-lock-fill"></i> Terkunci otomatis ke Parent ODC
                               </small>
                             )}
                           </div>
                        </div>
                      )}

                      {nodeForm.parentNodeId && (
                        <div className="p-4 bg-light rounded-4 border border-secondary-subtle mb-4 shadow-sm">
                          <h6 className="text-dark fw-bold mb-3 small text-uppercase tracking-wider d-flex align-items-center gap-2"><i className="bi bi-link-45deg text-primary fs-5"></i> Pengaturan Link Fiber</h6>
                          <div className="row g-3">
                            <div className="col-md-6">
                              <label className="form-label small fw-bold text-secondary mb-1">Tipe Kabel</label>
                              <select className="form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none" value={nodeForm.cableType} onChange={(e) => setNodeForm({ ...nodeForm, cableType: e.target.value })}>
                                {Object.entries(CABLE_TYPES).map(([key, val]) => <option key={key} value={key}>{getCableLabel(key)} ({val} core)</option>)}
                              </select>
                            </div>
                            <div className="col-md-6">
                              <label className="form-label small fw-bold text-secondary mb-1">Jarak Tarikan (meter)</label>
                              <input type="number" className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none" min="0" placeholder="contoh: 150" value={nodeForm.distanceMeter} onChange={(e) => setNodeForm({ ...nodeForm, distanceMeter: e.target.value })} />
                            </div>
                          </div>
                        </div>
                      )}

                      <h6 className="text-muted text-uppercase fw-bold mb-2 small tracking-wider"><i className="bi bi-geo-alt me-2 text-primary"></i>Koordinat Lokasi Node</h6>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <small className="text-muted"><i className="bi bi-hand-index me-1 text-primary"></i>Klik pada peta untuk menandai titik lokasi node</small>
                        {nodeForm.latitude && nodeForm.longitude && (
                          <button type="button" className="btn btn-sm btn-outline-danger rounded-3 py-1 px-2 shadow-sm" onClick={() => setNodeForm(prev => ({ ...prev, latitude: '', longitude: '' }))}>
                            <i className="bi bi-x-circle me-1"></i> Hapus Pin
                          </button>
                        )}
                      </div>
                      <div className="rounded-4 overflow-hidden border border-secondary-subtle shadow-sm mb-4">
                        <MapPicker
                          key={`node-map-${showModal}-${nodeForm.id}`}
                          lat={nodeForm.latitude}
                          lng={nodeForm.longitude}
                          height={240}
                          onChange={(lat, lng) => setNodeForm(prev => ({
                            ...prev,
                            latitude: lat === "" ? "" : Number(lat).toFixed(7),
                            longitude: lng === "" ? "" : Number(lng).toFixed(7),
                          }))}
                        />
                      </div>
                    </>
                  )}

                  {/* SPLITTER FORM */}
                  {modalType === 'splitter' && (
                    <>
                      <div className="mb-4">
                        <label className="form-label small fw-bold text-secondary mb-1">Pilih Node (ODC/ODP) *</label>
                        <select
                          className="form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                          required
                          value={splitterForm.nodeId}
                          onChange={(e) => setSplitterForm({ ...splitterForm, nodeId: e.target.value })}
                        >
                          <option value="">— Pilih Node —</option>
                          {nodes.map(n => (
                            <option key={n.id} value={n.id}>[{n.type}] {n.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="mb-4">
                        <label className="form-label small fw-bold text-secondary mb-1">Tipe Rasio Splitter *</label>
                        <select className="form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none" required value={splitterForm.type} onChange={(e) => { const type = e.target.value; const ports = SPLITTER_TYPES[type] || 8; setSplitterForm({ ...splitterForm, type, outputPort: ports }); }}>
                          {Object.entries(SPLITTER_TYPES).filter(([k]) => k !== 'NONE').map(([key, val]) => (<option key={key} value={key}>{getSplitterLabel(key)} ({val} port output)</option>))}
                        </select>
                      </div>
                      <div className="mb-4">
                        <label className="form-label small fw-bold text-secondary mb-1">Jumlah Port Output</label>
                        <input type="number" className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none" min="1" max="64" value={splitterForm.outputPort} onChange={(e) => setSplitterForm({ ...splitterForm, outputPort: Number(e.target.value) })} />
                        <small className="text-muted mt-1 d-block"><i className="bi bi-info-circle me-1"></i> Jumlah port output fiber yang akan dibuat secara otomatis</small>
                      </div>
                      <div className="mb-4">
                        <label className="form-label small fw-bold text-secondary mb-1">Nama Splitter (Opsional)</label>
                        <input className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none" placeholder="contoh: Splitter ODC 1" value={splitterForm.name} onChange={(e) => setSplitterForm({ ...splitterForm, name: e.target.value })} />
                      </div>
                      <div className="mb-2">
                        <label className="form-label small fw-bold text-secondary mb-1">Catatan / Deskripsi</label>
                        <textarea className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none" rows="2" placeholder="Tambahkan keterangan penempatan atau fungsi splitter..." value={splitterForm.description} onChange={(e) => setSplitterForm({ ...splitterForm, description: e.target.value })}></textarea>
                      </div>
                    </>
                  )}

                  {/* EDIT USER LOCATION FORM */}
                  {modalType === 'editUser' && (
                    <>
                      <div className="mb-4">
                        <label className="form-label small fw-bold text-secondary mb-1">Nama Pelanggan</label>
                        <input type="text" className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 bg-light shadow-none" value={userForm.username} readOnly />
                      </div>
                      <h6 className="text-muted text-uppercase fw-bold mb-2 small tracking-wider"><i className="bi bi-geo-alt me-2 text-primary"></i>Titik Lokasi Pelanggan</h6>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <small className="text-muted"><i className="bi bi-hand-index me-1 text-primary"></i>Klik pada peta untuk menentukan koordinat akurat rumah pelanggan</small>
                        {userForm.latitude && userForm.longitude && (
                          <button type="button" className="btn btn-sm btn-outline-danger rounded-3 py-1 px-2 shadow-sm" onClick={() => setUserForm(prev => ({ ...prev, latitude: '', longitude: '' }))}>
                            <i className="bi bi-x-circle me-1"></i> Hapus Pin
                          </button>
                        )}
                      </div>
                      <div className="rounded-4 overflow-hidden border border-secondary-subtle shadow-sm mb-4">
                        <MapPicker
                          key={`user-map-${showModal}-${userForm.username}`}
                          lat={userForm.latitude}
                          lng={userForm.longitude}
                          height={260}
                          onChange={(lat, lng) => setUserForm(prev => ({
                            ...prev,
                            latitude: lat === "" ? "" : Number(lat).toFixed(7),
                            longitude: lng === "" ? "" : Number(lng).toFixed(7),
                          }))}
                        />
                      </div>
                      <div className="alert alert-info border border-info-subtle bg-info bg-opacity-10 rounded-4 p-3 small mb-0 shadow-sm d-flex align-items-center gap-2">
                        <i className="bi bi-info-circle-fill text-info fs-5"></i>
                        <div>Koordinat GPS ini digunakan untuk merekomendasikan port ODP terdekat secara otomatis saat pemasangan kabel fisik.</div>
                      </div>
                    </>
                  )}

                  {/* ASSIGN FORM */}
                  {modalType === 'assign' && (() => {
                    const currentOutput = splitters.flatMap(s => s.outputs || []).find(o => Number(o.id) === Number(modalData?.outputId || assignForm.outputId));
                    const currentSplitter = splitters.find(s => s.id === currentOutput?.splitterId);
                    const parentNode = nodes.find(n => n.id === currentSplitter?.nodeId);
                    const isOdcSplitter = parentNode?.type === 'ODC';

                    return (
                      <>
                        {isOdcSplitter ? (
                          <div className="mb-4">
                            <label className="form-label small fw-bold text-secondary mb-2">Tipe Pemasangan Port (ODC Splitter) *</label>
                            <div className="d-flex gap-2 p-1 bg-light rounded-3 border border-secondary-subtle">
                              <button 
                                type="button" 
                                className={`btn btn-sm flex-fill fw-semibold rounded-2 py-2 ${assignForm.assignType === 'client' ? 'btn-primary shadow-sm' : 'btn-light text-muted'}`}
                                onClick={() => setAssignForm({ ...assignForm, assignType: 'client', targetNodeId: '' })}
                              >
                                <i className="bi bi-people me-2"></i>Ke Pelanggan (Client)
                              </button>
                              <button 
                                type="button" 
                                className={`btn btn-sm flex-fill fw-semibold rounded-2 py-2 ${assignForm.assignType === 'node' ? 'btn-primary shadow-sm' : 'btn-light text-muted'}`}
                                onClick={() => setAssignForm({ ...assignForm, assignType: 'node', clientId: '' })}
                              >
                                <i className="bi bi-diagram-2 me-2"></i>Ke Node Lanjutan (ODC/ODP)
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="alert alert-warning border border-warning-subtle bg-warning bg-opacity-10 rounded-4 p-3 small mb-4 shadow-sm d-flex align-items-center gap-2">
                            <i className="bi bi-info-circle-fill text-warning fs-5"></i>
                            <div><strong>Aturan Topologi ODP:</strong> Port splitter pada ODP hanya dapat dihubungkan langsung ke Pelanggan (PPPoE Client).</div>
                          </div>
                        )}

                        {assignForm.assignType === 'node' ? (
                          <div className="mb-4 bg-light p-4 rounded-4 border border-secondary-subtle text-center animate__animated animate__fadeIn">
                            <i className="bi bi-diagram-3-fill text-primary fs-1 d-block mb-2"></i>
                            <h6 className="fw-bold text-dark mb-1">Penambahan Node Lanjutan (ODC / ODP)</h6>
                            <p className="text-muted small mb-4">
                              Berdasarkan aturan topologi fisik jaringan FTTH, setiap node lanjutan harus dibuat baru agar terhubung langsung secara eksklusif ke port fiber ini. Node yang sudah ada tidak dapat dipilih karena telah terhubung ke jalur lain.
                            </p>
                            <button 
                              type="button" 
                              className="btn btn-primary btn-lg px-4 fw-semibold shadow-sm d-inline-flex align-items-center gap-2"
                              onClick={() => {
                                setNodeForm({
                                  id: null, name: "", type: "ODC", oltPortId: parentNode?.oltPortId || '',
                                  parentNodeId: parentNode?.id || '', latitude: "", longitude: "", description: "",
                                  cableType: "BACKBONE_12_CORE", totalCore: 12, distanceMeter: "",
                                  splitterOutputId: assignForm.outputId
                                });
                                setModalData({
                                  parentNodeId: parentNode?.id, oltPortId: parentNode?.oltPortId, type: "ODC"
                                });
                                setModalType('node');
                              }}
                            >
                              <i className="bi bi-plus-circle-fill fs-5"></i>Buat Node Baru (ODC / ODP)
                            </button>
                          </div>
                        ) : (
                          <div className="mb-4">
                            <label className="form-label small fw-bold text-secondary mb-1">Akun PPPoE Pelanggan *</label>
                            <div className="position-relative">
                              <button 
                                type="button" 
                                className="form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none text-start d-flex justify-content-between align-items-center bg-white w-100 py-2 px-3"
                                onClick={() => setClientDropdownOpen(!clientDropdownOpen)}
                              >
                                <span className={assignForm.clientId ? "text-dark fw-medium" : "text-muted"}>
                                  {assignForm.clientId 
                                    ? (() => {
                                        const u = availableUsers.find(u => Number(u.id) === Number(assignForm.clientId));
                                        return u ? `${u.username} ${u.latitude ? '📍 (Ada Lokasi)' : '(Belum Ada Lokasi)'}` : '— Pilih Pelanggan —';
                                      })()
                                    : '— Pilih Pelanggan —'
                                  }
                                </span>
                              </button>

                              {clientDropdownOpen && (
                                <div className="position-absolute start-0 end-0 mt-1 bg-white border border-secondary-subtle rounded-3 shadow-lg z-3" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                                  <div className="p-2 border-bottom position-sticky top-0 bg-white z-2">
                                    <div className="input-group input-group-sm shadow-sm">
                                      <span className="input-group-text bg-light border-secondary-subtle text-muted"><i className="bi bi-search"></i></span>
                                      <input 
                                        type="text" 
                                        className="form-control border-secondary-subtle shadow-none fs-6" 
                                        placeholder="Ketik nama pelanggan untuk mencari..." 
                                        value={userSearch} 
                                        onChange={(e) => setUserSearch(e.target.value)}
                                        autoFocus 
                                      />
                                      {userSearch && (
                                        <button type="button" className="btn btn-outline-secondary border-secondary-subtle" onClick={() => setUserSearch('')}>
                                          <i className="bi bi-x-lg"></i>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="list-group list-group-flush">
                                    {availableUsers
                                      .filter(u => !userSearch || u.username.toLowerCase().includes(userSearch.toLowerCase()))
                                      .map(u => (
                                        <button 
                                          key={u.id} 
                                          type="button" 
                                          className={`list-group-item list-group-item-action py-2 px-3 text-start fs-6 ${Number(assignForm.clientId) === Number(u.id) ? 'bg-primary-subtle text-primary fw-bold' : ''}`}
                                          onClick={() => {
                                            setAssignForm({ ...assignForm, clientId: u.id.toString() });
                                            setClientDropdownOpen(false);
                                            setUserSearch('');
                                          }}
                                        >
                                          <div className="d-flex justify-content-between align-items-center">
                                            <span>{u.username}</span>
                                            <small className="text-muted">{u.latitude ? '📍 Ada Lokasi' : 'Belum Ada Lokasi'}</small>
                                          </div>
                                        </button>
                                      ))}
                                    {availableUsers.filter(u => !userSearch || u.username.toLowerCase().includes(userSearch.toLowerCase())).length === 0 && (
                                      <div className="p-3 text-center text-muted small fst-italic">
                                        Tidak ada pelanggan yang cocok dengan "{userSearch}"
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="mb-4">
                          <label className="form-label small fw-bold text-secondary mb-1">
                            {assignForm.assignType === 'client' && assignForm.clientId ? 'Rekomendasi Port Fiber Terdekat (Auto-Sorted) *' : 'Daftar Port Fiber Tersedia *'}
                          </label>
                          <select 
                            className={`form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none ${modalData?.outputId ? 'bg-light' : ''}`}
                            required 
                            disabled={!!modalData?.outputId}
                            value={assignForm.outputId} 
                            onChange={(e) => setAssignForm({ ...assignForm, outputId: e.target.value })}
                          >
                            {modalData?.outputId ? (
                              (() => {
                                const out = splitters.flatMap(s => s.outputs || []).find(o => o.id === Number(modalData.outputId));
                                const spl = splitters.find(s => s.id === out?.splitterId);
                                const nod = nodes.find(n => n.id === spl?.nodeId);
                                return (
                                  <option value={out?.id}>
                                    {nod?.name} • {spl?.name || `Splitter #${spl?.id}`} • Port #{out?.portNumber}
                                  </option>
                                );
                              })()
                            ) : (
                              <>
                                <option value="">— Pilih Port Fiber —</option>
                                {(() => {
                                  const selectedUser = pppoeUsers.find(u => Number(u.id) === Number(assignForm.clientId));
                                  
                                  const options = splitters.flatMap(s => {
                                    const node = nodes.find(n => Number(n.id) === Number(s.nodeId));
                                    const dist = selectedUser && node ? getDistance(selectedUser.latitude, selectedUser.longitude, node.latitude, node.longitude) : Infinity;
                                    
                                    return (s.outputs || [])
                                      .filter(o => !o.isUsed)
                                      .map(o => ({
                                        ...o,
                                        splitterName: s.name || `Splitter #${s.id}`,
                                        nodeName: node?.name || `Node #${s.nodeId}`,
                                        nodeType: node?.type || '?',
                                        distance: dist
                                      }));
                                  });

                                  if (selectedUser?.latitude) {
                                    options.sort((a, b) => a.distance - b.distance);
                                  }

                                  return options.map(o => (
                                    <option key={o.id} value={o.id}>
                                      {o.distance !== Infinity ? `[${o.distance}m] ` : ''}
                                      {o.nodeName} • {o.splitterName} • Port #{o.portNumber}
                                    </option>
                                  ));
                                })()}
                              </>
                            )}
                          </select>
                          {assignForm.assignType === 'client' && assignForm.clientId && !pppoeUsers.find(u => Number(u.id) === Number(assignForm.clientId))?.latitude && (
                            <div className="small text-danger mt-2 d-flex align-items-center gap-1 fw-medium">
                              <i className="bi bi-exclamation-triangle-fill"></i> Pelanggan belum memiliki koordinat GPS. Rekomendasi port terdekat tidak dapat ditampilkan.
                            </div>
                          )}
                        </div>
                        
                        {assignForm.outputId && (assignForm.clientId || assignForm.targetNodeId) && (
                          <div className="alert alert-success border border-success-subtle bg-success bg-opacity-10 rounded-4 p-3 small mb-0 shadow-sm d-flex align-items-center gap-2">
                            <i className="bi bi-check-circle-fill text-success fs-5"></i> 
                            <div>Jalur siap diaktifkan. Setelah kabel fisik dicolok, status koneksi akan otomatis terdeteksi.</div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="modal-footer py-3 px-4 bg-light border-top border-secondary-subtle">
                  <button type="button" className="btn btn-secondary rounded-3 px-4 py-2 fw-medium shadow-sm" onClick={closeModal} disabled={submitting}>Batal</button>
                  <button type="submit" className="btn btn-primary rounded-3 px-4 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2" disabled={submitting}>
                    {submitting ? (<><span className="spinner-border spinner-border-sm" role="status"></span> Menyimpan...</>) : (<><i className="bi bi-check-lg"></i> Simpan Perubahan</>)}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================= DELETE CONFIRMATION ========================= */}
      {deleteId && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white">
              <div className="modal-header bg-danger bg-opacity-10 py-3 px-4 border-bottom border-danger-subtle d-flex align-items-center justify-content-between">
                <h5 className="modal-title text-danger fw-bold d-flex align-items-center gap-2 fs-5 mb-0">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  <span>Hapus {deleteType === 'oltPort' ? 'OLT Port' : deleteType === 'node' ? 'Node' : 'Splitter'}?</span>
                </h5>
                <button type="button" className="btn-close bg-danger bg-opacity-10 p-2 rounded-circle shadow-none" onClick={() => { setDeleteId(null); setDeleteType(null); }}></button>
              </div>
              <div className="modal-body p-4">
                <p className="text-secondary mb-0 fs-6">Apakah Anda yakin ingin menghapus item ini? <br/><strong className="text-danger fw-semibold">Tindakan ini tidak dapat dibatalkan.</strong></p>
                {deleteType === 'oltPort' && oltPorts.find(p => p.id === deleteId) && (<div className="mt-4 p-3 bg-light border border-secondary-subtle rounded-4 shadow-sm"><div className="small text-muted fw-medium mb-1">Item yang akan dihapus:</div><div className="fw-bold text-dark fs-6">{oltPorts.find(p => p.id === deleteId)?.name}</div><div className="small text-muted mt-1"><code className="bg-secondary bg-opacity-10 px-2 py-1 rounded text-dark fw-semibold">{oltPorts.find(p => p.id === deleteId)?.port}</code></div></div>)}
                {deleteType === 'node' && nodes.find(n => n.id === deleteId) && (<div className="mt-4 p-3 bg-light border border-secondary-subtle rounded-4 shadow-sm"><div className="small text-muted fw-medium mb-1">Item yang akan dihapus:</div><div className="fw-bold text-dark fs-6">{nodes.find(n => n.id === deleteId)?.name}</div><div className="small text-muted mt-1">Tipe: <span className="badge bg-secondary">{nodes.find(n => n.id === deleteId)?.type}</span></div></div>)}
                {deleteType === 'splitter' && splitters.find(s => s.id === deleteId) && (<div className="mt-4 p-3 bg-light border border-secondary-subtle rounded-4 shadow-sm"><div className="small text-muted fw-medium mb-1">Splitter yang akan dihapus:</div><div className="fw-bold text-dark fs-6">{splitters.find(s => s.id === deleteId)?.name || `Splitter #${deleteId}`}</div></div>)}
              </div>
              <div className="modal-footer py-3 px-4 bg-light border-top border-secondary-subtle justify-content-end gap-2">
                <button className="btn btn-secondary rounded-3 px-4 py-2 fw-medium shadow-sm" onClick={() => { setDeleteId(null); setDeleteType(null); }}>Batal</button>
                <button className="btn btn-danger rounded-3 px-4 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2" onClick={confirmDelete}><i className="bi bi-trash"></i>Ya, Hapus</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================= CUSTOM TOAST ========================= */}
      {toast.show && (
        <div className={`position-fixed bottom-0 end-0 p-3`} style={{ zIndex: 2000 }}>
          <div className={`toast show align-items-center text-white bg-${toast.type} border-0 shadow-lg`} role="alert">
            <div className="d-flex">
              <div className="toast-body">
                <i className={`bi bi-${toast.type === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2`}></i>
                {toast.message}
              </div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast({ ...toast, show: false })}></button>
            </div>
          </div>
        </div>
      )}

      {/* ========================= CUSTOM CONFIRM DIALOG ========================= */}
      {confirm.show && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 1900 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white">
              <div className="modal-body p-5 text-center">
                <div className="display-4 text-warning mb-3"><i className="bi bi-question-circle-fill"></i></div>
                <h5 className="fw-bold text-dark mb-3 fs-4">Konfirmasi Tindakan</h5>
                <p className="text-secondary mb-4 fs-6" style={{ whiteSpace: 'pre-line' }}>{confirm.message}</p>
                <div className="d-flex gap-3 justify-content-center">
                  <button className="btn btn-secondary rounded-3 px-4 py-2 fw-medium shadow-sm" onClick={() => setConfirm({ show: false, message: "", onConfirm: null })}>Batal</button>
                  <button className="btn btn-primary rounded-3 px-4 py-2 fw-semibold shadow-sm" onClick={() => { confirm.onConfirm(); setConfirm({ show: false, message: "", onConfirm: null }); }}>Ya, Lanjutkan</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-muted small mt-4 pb-3"><i className="bi bi-shield-check me-1"></i>FTTH Topology Manager • Network Operations Center</div>
    </div>
  );
}