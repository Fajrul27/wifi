import React, { useState, useEffect } from "react";
import api from "../../services/api";
import OltPortManager from "./components/OltPortManager";
import TopologyTreeView from "./components/TopologyTreeView";
import PppoeManager from "./components/PppoeManager";
import TopologyFlowChart from "./components/TopologyFlowChart";
import TopologyModals from "./components/TopologyModals";
import TopologyDeleteModal from "./components/TopologyDeleteModal";
import TopologyHeader from "./components/TopologyHeader";
import TopologyNotifications from "./components/TopologyNotifications";
import { useTopologyData } from "./useTopologyData";
import {
  CABLE_TYPES,
  SPLITTER_TYPES,
  DEFAULT_OLT_PORT_FORM,
  DEFAULT_NODE_FORM,
  DEFAULT_SPLITTER_FORM,
  DEFAULT_ASSIGN_FORM,
  DEFAULT_USER_FORM,
} from "./topologyConstants";
import {
  getCableLabel,
  getSplitterLabel,
  formatCoord,
  getDistance,
} from "./topologyUtils";

export default function FtthTopologyManager() {
  /* ───────────────── CUSTOM HOOK: DATA & REALTIME ───────────────── */
  const {
    loading,
    setLoading,
    selectedRouter,
    setSelectedRouter,
    setSelectedOltPort,
    routers,
    oltPorts,
    nodes,
    splitters,
    pppoeUsers,
    realtimeTopology,
    scanResults,
    setScanResults,
    scanning,
    setScanning,
    loadData,
    provisioningStats,
    filteredOltPorts,
    filteredNodes,
    availableUsers,
    stats,
  } = useTopologyData();

  /* ───────────────── UI & MODAL STATE ───────────────── */
  const [submitting, setSubmitting] = useState(false);
  const [selectedTab, setSelectedTab] = useState("olt-ports");

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
  const [oltPortForm, setOltPortForm] = useState(DEFAULT_OLT_PORT_FORM);
  const [nodeForm, setNodeForm] = useState(DEFAULT_NODE_FORM);
  const [splitterForm, setSplitterForm] = useState(DEFAULT_SPLITTER_FORM);
  const [assignForm, setAssignForm] = useState(DEFAULT_ASSIGN_FORM);
  const [userForm, setUserForm] = useState(DEFAULT_USER_FORM);
  const [userSearch, setUserSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);

  /* ───────────────── HELPERS ───────────────── */
  const getRouterName = (id) => routers.find((r) => r.id === id)?.name || `Router #${id}`;

  /* ───────────────── MODAL HANDLERS ───────────────── */
  const openModal = (type, data = null) => {
    setModalType(type);
    setModalData(data);

    if (type === "oltPort") {
      setOltPortForm({
        id: data?.id || null,
        name: data?.name || "",
        port: data?.port || "",
        routerId: data?.routerId || selectedRouter || "",
        latitude: data?.latitude ?? "",
        longitude: data?.longitude ?? "",
      });
    }
    if (type === "node") {
      const parentLink = data?.incomingLinks?.[0] || null;
      const parentId = parentLink?.fromNodeId || data?.parentNodeId || "";
      let pNode = nodes.find((n) => Number(n.id) === Number(parentId));
      let oltId = data?.oltPortId || pNode?.oltPortId || "";

      // Jika pNode.oltPortId kosong, telusuri ke atas melalui incomingLinks / parentNodeId sampai ketemu oltPortId
      let curr = pNode;
      while (!oltId && curr) {
        const nextParentId = curr.incomingLinks?.[0]?.fromNodeId || curr.parentNodeId;
        if (!nextParentId) break;
        curr = nodes.find((n) => Number(n.id) === Number(nextParentId));
        oltId = curr?.oltPortId || "";
      }

      setNodeForm({
        id: data?.id || null,
        name: data?.name || "",
        type: data?.type || "ODC",
        oltPortId: oltId,
        parentNodeId: parentId,
        latitude: data?.latitude ?? "",
        longitude: data?.longitude ?? "",
        description: data?.description || "",
        cableType: parentLink?.cableType || "BACKBONE_12_CORE",
        totalCore: parentLink?.totalCore || 12,
        distanceMeter: parentLink?.distanceMeter ?? "",
        splitterType: data?.splitters?.[0]?.type || "SPLITTER_1_8",
        splitterOutputId: data?.splitterOutputId || null,
      });
    }
    if (type === "splitter") {
      setSplitterForm({
        id: data?.id || null,
        nodeId: data?.nodeId || "",
        type: data?.type || "SPLITTER_1_8",
        outputPort: data?.outputPort || 8,
        name: data?.name || "",
        description: data?.description || "",
      });
    }
    if (type === "assign") {
      setAssignForm({
        outputId: data?.outputId || "",
        clientId: data?.clientId || "",
        targetNodeId: data?.targetNodeId || "",
        assignType: "client",
        showExistingNodeSelect: false,
      });
      setUserSearch("");
      setClientDropdownOpen(false);
    }
    if (type === "editUser") {
      setUserForm({
        id: data.id,
        username: data.username,
        latitude: data.latitude || "",
        longitude: data.longitude || "",
      });
    }
    setShowModal(true);
  };

  // 🎯 Auto-Select Port Terdekat saat User dipilih di Modal Assign
  useEffect(() => {
    if (modalType === "assign" && assignForm.clientId) {
      const selectedUser = pppoeUsers.find((u) => Number(u.id) === Number(assignForm.clientId));
      if (selectedUser?.latitude && !assignForm.outputId) {
        // Cari port terdekat
        const options = splitters.flatMap((s) => {
          const node = nodes.find((n) => Number(n.id) === Number(s.nodeId));
          const dist = getDistance(
            selectedUser.latitude,
            selectedUser.longitude,
            node?.latitude,
            node?.longitude
          );
          return (s.outputs || []).filter((o) => !o.isUsed).map((o) => ({ id: o.id, distance: dist }));
        });

        if (options.length > 0) {
          options.sort((a, b) => a.distance - b.distance);
          setAssignForm((prev) => ({ ...prev, outputId: options[0].id.toString() }));
        }
      }
    }
  }, [modalType, assignForm.clientId, assignForm.outputId, pppoeUsers, splitters, nodes]);

  const closeModal = () => {
    setShowModal(false);
    setModalType(null);
    setModalData(null);
    setUserSearch("");
    setClientDropdownOpen(false);
  };

  /* ───────────────── SUBMIT HANDLERS ───────────────── */
  const submitOltPort = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        routerId: Number(oltPortForm.routerId),
        name: oltPortForm.name,
        port: oltPortForm.port,
        latitude: oltPortForm.latitude !== "" ? parseFloat(oltPortForm.latitude) : null,
        longitude: oltPortForm.longitude !== "" ? parseFloat(oltPortForm.longitude) : null,
      };
      let res;
      if (oltPortForm.id) res = await api.put(`/olt-ports/${oltPortForm.id}`, payload);
      else res = await api.post("/olt-ports", payload);
      if (res.data && res.data.success === false)
        throw new Error(res.data.message || "Gagal menyimpan OLT Port");
      await loadData();
      closeModal();
      showToast("OLT Port berhasil disimpan!", "success");
    } catch (err) {
      showToast("Gagal: " + (err.response?.data?.message || err.message), "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const submitNode = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: nodeForm.name,
        type: nodeForm.type,
        oltPortId: nodeForm.oltPortId ? Number(nodeForm.oltPortId) : null,
        parentNodeId: nodeForm.parentNodeId ? Number(nodeForm.parentNodeId) : null,
        latitude: nodeForm.latitude !== "" ? parseFloat(nodeForm.latitude) : null,
        longitude: nodeForm.longitude !== "" ? parseFloat(nodeForm.longitude) : null,
        description: nodeForm.description || null,
        cableType: nodeForm.parentNodeId ? nodeForm.cableType : undefined,
        totalCore: nodeForm.parentNodeId ? Number(nodeForm.totalCore) : undefined,
        distanceMeter:
          nodeForm.parentNodeId && nodeForm.distanceMeter !== "" ? Number(nodeForm.distanceMeter) : undefined,
        splitterType: nodeForm.splitterType || undefined,
      };
      Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
      let res;
      if (nodeForm.id) {
        res = await api.put(`/topology/${nodeForm.id}`, payload);
      } else {
        if (payload.type === "ODP" && !payload.parentNodeId) {
          throw new Error("Pilih 'Parent Node (ODC)' sebagai sumber kabel untuk ODP ini.");
        }
        res = await api.post("/topology", payload);
      }
      if (res.data && res.data.success === false) {
        throw new Error(res.data.message || "Gagal menyimpan node");
      }
      if (!nodeForm.id && nodeForm.splitterOutputId && res.data?.data?.id) {
        await api.put(`/splitter/output/${nodeForm.splitterOutputId}/assign`, {
          targetNodeId: Number(res.data.data.id),
        });
      }
      await loadData();
      closeModal();
      showToast("Node berhasil disimpan!", "success");
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      showToast("⚠️ Gagal menyimpan: " + msg, "danger");
    } finally {
      setSubmitting(false);
    }
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
        nodeId: Number(splitterForm.nodeId),
        type: splitterForm.type,
        outputPort: Number(splitterForm.outputPort),
        name: splitterForm.name || null,
        description: splitterForm.description || null,
      };
      const res = await api.post("/splitter", payload);
      if (res.data && res.data.success === false)
        throw new Error(res.data.message || "Gagal menyimpan splitter");
      const splitterId = res.data?.data?.id;
      if (splitterId) await api.post(`/splitter/${splitterId}/generate`);
      await loadData();
      closeModal();
      showToast("Splitter berhasil disimpan!", "success");
    } catch (err) {
      showToast("Gagal: " + (err.response?.data?.message || err.message), "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const submitAssign = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        targetNodeId:
          assignForm.assignType === "node" && assignForm.targetNodeId ? Number(assignForm.targetNodeId) : null,
        clientId:
          assignForm.assignType === "client" && assignForm.clientId ? Number(assignForm.clientId) : null,
      };
      const res = await api.put(`/splitter/output/${assignForm.outputId}/assign`, payload);
      if (res.data && res.data.success === false)
        throw new Error(res.data.message || "Gagal memasang pelanggan");
      await loadData();
      closeModal();
      showToast("Pelanggan berhasil dipasang ke port!", "success");
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      showToast("⚠️ Gagal memasang pelanggan: " + msg, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassignClient = async (clientId) => {
    const targetId = Number(clientId);
    const user = pppoeUsers.find((u) => Number(u.id) === targetId);

    showConfirm(
      `Yakin ingin MEMUTUS layanan untuk ${
        user?.username || "pelanggan ini"
      }?\n\nJalur kabel akan dilepas dan internet di Mikrotik akan otomatis DIMATIKAN.`,
      async () => {
        setLoading(true);
        try {
          let targetOutputId = null;

          // 1. Cari lokal dulu
          for (const s of splitters) {
            const found = (s.outputs || []).find((o) => o.isUsed && Number(o.clientId) === targetId);
            if (found) {
              targetOutputId = found.id;
              break;
            }
          }

          // 2. Jika tidak ada di lokal, tanya database (Sync Fallback)
          if (!targetOutputId) {
            const res = await api.get(`/splitter/output/client/${targetId}`);
            if (res.data?.data?.id) {
              targetOutputId = res.data.data.id;
            }
          }

          if (!targetOutputId) {
            showConfirm(
              "Jalur kabel fisik tidak ditemukan di database (Data Mismatch).\n\nIngin RESET PAKSA status pelanggan ini agar bisa dipasang ulang dari awal?",
              async () => {
                try {
                  setLoading(true);
                  await api.post(`/splitter/user/${targetId}/force-reset`);
                  await loadData();
                  showToast("Status pelanggan berhasil direset paksa.", "success");
                } catch (err) {
                  showToast("Gagal reset: " + err.message, "danger");
                } finally {
                  setLoading(false);
                }
              }
            );
            return;
          }

          await api.put(`/splitter/output/${targetOutputId}/unassign`);
          await loadData();
          showToast(`Layanan ${user?.username} berhasil diputus.`, "success");
        } catch (err) {
          showToast("Gagal memutus: " + (err.response?.data?.message || err.message), "danger");
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handleUnassignPort = async (outputId) => {
    let output = null;
    for (const s of splitters) {
      const found = (s.outputs || []).find((o) => Number(o.id) === Number(outputId));
      if (found) {
        output = found;
        break;
      }
    }

    const label = output?.client?.username
      ? `pelanggan ${output.client.username}`
      : output?.targetNode?.name
      ? `node lanjutan [${output.targetNode.type}] ${output.targetNode.name}`
      : `port #${output?.portNumber || outputId}`;

    showConfirm(
      `Yakin ingin MEMUTUS jalur koneksi pada ${label}?\n\nJika ini adalah pelanggan, akses internet di Mikrotik akan otomatis DIMATIKAN.`,
      async () => {
        setLoading(true);
        try {
          await api.put(`/splitter/output/${outputId}/unassign`);
          await loadData();
          showToast(`Jalur koneksi pada ${label} berhasil diputus.`, "success");
        } catch (err) {
          showToast("Gagal memutus: " + (err.response?.data?.message || err.message), "danger");
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/pppoe/${selectedRouter}/user/${userForm.id}/location`, {
        latitude: parseFloat(userForm.latitude),
        longitude: parseFloat(userForm.longitude),
      });
      await loadData();
      closeModal();
      showToast("Lokasi pelanggan berhasil diperbarui!", "success");
    } catch (err) {
      showToast("Gagal update lokasi: " + (err.response?.data?.message || err.message), "danger");
    } finally {
      setSubmitting(false);
    }
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
      setScanResults((prev) => prev.filter((p) => p.name !== iface.name));
      await loadData();
      showToast(`Port ${iface.name} berhasil ditambahkan!`, "success");
    } catch (err) {
      showToast("Gagal menambah port: " + (err.response?.data?.message || err.message), "danger");
    }
  };

  const confirmDelete = async () => {
    try {
      let res;
      if (deleteType === "oltPort") res = await api.delete(`/olt-ports/${deleteId}`);
      else if (deleteType === "node") res = await api.delete(`/topology/${deleteId}`);
      else if (deleteType === "splitter") res = await api.delete(`/splitter/${deleteId}`);

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
    <span
      className={`badge rounded-pill px-3 py-2 border ${
        online
          ? "bg-success-subtle text-success border-success-subtle"
          : "bg-secondary-subtle text-secondary border-secondary-subtle"
      }`}
    >
      <i
        className={`bi bi-circle-fill me-1 ${online ? "text-success" : "text-secondary"}`}
        style={{ fontSize: "0.6rem" }}
      ></i>
      {online ? "Online" : "Offline"}
    </span>
  );

  /* ───────────────── RENDER ───────────────── */
  return (
    <div className="container-fluid py-4" style={{ background: "#f8f9fa", minHeight: "100vh" }}>
      {/* ===== HEADER & NAVIGATION ===== */}
      <TopologyHeader
        loadData={loadData}
        loading={loading}
        stats={stats}
        routers={routers}
        selectedRouter={selectedRouter}
        setSelectedRouter={setSelectedRouter}
        openModal={openModal}
        provisioningStats={provisioningStats}
        selectedTab={selectedTab}
        setSelectedTab={setSelectedTab}
        showToast={showToast}
        filteredOltPortsCount={filteredOltPorts.length}
        filteredNodesCount={filteredNodes.length}
        pppoeUsersCount={pppoeUsers.length}
      />

      {/* ===== TAB CONTENT ===== */}
      {selectedTab === "olt-ports" && (
        <>
          <div className="mb-3 d-flex gap-2">
            <button className="btn btn-outline-primary btn-sm" onClick={scanInterfaces} disabled={scanning}>
              {scanning ? (
                <span className="spinner-border spinner-border-sm me-1"></span>
              ) : (
                <i className="bi bi-search me-1"></i>
              )}
              Scan Interface Mikrotik
            </button>
          </div>

          {scanResults.length > 0 && (
            <div className="alert alert-info border-0 shadow-sm mb-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0 fw-bold">
                  <i className="bi bi-cpu me-2"></i>Interface Baru Terdeteksi
                </h6>
                <button className="btn-close" onClick={() => setScanResults([])}></button>
              </div>
              <div className="d-flex flex-wrap gap-2">
                {scanResults.map((p) => (
                  <div
                    key={p.name}
                    className="badge bg-white text-dark border p-2 d-flex align-items-center gap-2 shadow-sm"
                  >
                    <span>
                      {p.name} <small className="text-muted">({p.type})</small>
                    </span>
                    <button
                      className="btn btn-primary btn-sm py-0 px-2"
                      onClick={() => addScannedPort(p)}
                      style={{ fontSize: "0.65rem" }}
                    >
                      + Add
                    </button>
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
            onEdit={(port) => openModal("oltPort", port)}
            onDelete={(id) => {
              setDeleteId(id);
              setDeleteType("oltPort");
            }}
            onAddNode={(oltPortId) => openModal("node", { type: "ODC", oltPortId })}
            onViewTopology={(portId) => {
              setSelectedOltPort(portId);
              setSelectedTab("topology");
            }}
            formatCoord={formatCoord}
            getRouterName={getRouterName}
            StatusBadge={StatusBadge}
          />
        </>
      )}

      {selectedTab === "topology" && (
        <div className="card border shadow-sm">
          <div className="card-header bg-white border-bottom py-3">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <h5 className="mb-0 fw-semibold text-dark">
                <i className="bi bi-diagram-2 me-2 text-primary" />
                Topology Network
                <span className="badge bg-secondary ms-2">{filteredNodes.length}</span>
              </h5>
              <div className="d-flex gap-2">
                <button className="btn btn-success btn-sm" onClick={() => openModal("node")}>
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
              onEdit={(node) => openModal("node", node)}
              onDelete={(id) => {
                setDeleteId(id);
                setDeleteType("node");
              }}
              onAddChild={(parentId, type) => openModal("node", { type, parentNodeId: parentId })}
              onAddSplitter={(nodeId) => openModal("splitter", { nodeId })}
              onEditSplitter={(splitter) => openModal("splitter", splitter)}
              onDeleteSplitter={(id) => {
                setDeleteId(id);
                setDeleteType("splitter");
              }}
              onAssignClient={(id) => {
                const isOutput = splitters.some((s) =>
                  (s.outputs || []).some((o) => Number(o.id) === Number(id))
                );
                if (isOutput) {
                  openModal("assign", { outputId: id });
                } else {
                  openModal("assign", { targetNodeId: id });
                }
              }}
              onUnassignPort={handleUnassignPort}
            />
          </div>
        </div>
      )}

      {selectedTab === "chart" && (
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

      {selectedTab === "pppoe" && (
        <PppoeManager
          users={pppoeUsers}
          nodes={nodes}
          availableUsers={availableUsers}
          onAssign={(userId) => openModal("assign", { clientId: userId })}
          onUnassign={handleUnassignClient}
          onEditLocation={(user) => openModal("editUser", user)}
          formatCoord={formatCoord}
          StatusBadge={StatusBadge}
        />
      )}

      {/* ========================= SHARED MODALS ========================= */}
      <TopologyModals
        showModal={showModal}
        modalType={modalType}
        modalData={modalData}
        closeModal={closeModal}
        submitting={submitting}
        routers={routers}
        filteredOltPorts={filteredOltPorts}
        nodes={nodes}
        splitters={splitters}
        availableUsers={availableUsers}
        pppoeUsers={pppoeUsers}
        oltPortForm={oltPortForm}
        setOltPortForm={setOltPortForm}
        nodeForm={nodeForm}
        setNodeForm={setNodeForm}
        splitterForm={splitterForm}
        setSplitterForm={setSplitterForm}
        userForm={userForm}
        setUserForm={setUserForm}
        assignForm={assignForm}
        setAssignForm={setAssignForm}
        submitOltPort={submitOltPort}
        submitNode={submitNode}
        submitSplitter={submitSplitter}
        handleUpdateUser={handleUpdateUser}
        submitAssign={submitAssign}
        clientDropdownOpen={clientDropdownOpen}
        setClientDropdownOpen={setClientDropdownOpen}
        userSearch={userSearch}
        setUserSearch={setUserSearch}
        SPLITTER_TYPES={SPLITTER_TYPES}
        CABLE_TYPES={CABLE_TYPES}
        getSplitterLabel={getSplitterLabel}
        getCableLabel={getCableLabel}
        getDistance={getDistance}
        setModalData={setModalData}
        openModal={openModal}
      />

      {/* ========================= DELETE CONFIRMATION ========================= */}
      <TopologyDeleteModal
        deleteId={deleteId}
        deleteType={deleteType}
        oltPorts={oltPorts}
        nodes={nodes}
        splitters={splitters}
        confirmDelete={confirmDelete}
        onCancel={() => {
          setDeleteId(null);
          setDeleteType(null);
        }}
      />

      {/* ========================= CUSTOM NOTIFICATIONS ========================= */}
      <TopologyNotifications
        toast={toast}
        setToast={setToast}
        confirm={confirm}
        setConfirm={setConfirm}
      />

      {/* Footer */}
      <div className="text-center text-muted small mt-4 pb-3">
        <i className="bi bi-shield-check me-1"></i>FTTH Topology Manager • Network Operations Center
      </div>
    </div>
  );
}