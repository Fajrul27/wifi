// pages/OltManagement.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import api from "../../services/api";
import OdcForm from "./components/OdcForm";
import OdpForm from "./components/OdpForm";
import PortItem from "./components/PortItem";
import MapPicker from "../../components/MapPicker";

// ─────────────────────────────────────────────────────────────
// CONFIG & UTILS
// ─────────────────────────────────────────────────────────────
const formatCoordinate = (v) => (v ? parseFloat(v).toFixed(4) : "-");
const generateNextPort = (existingPorts) => {
  const indexes = existingPorts
    .map((p) => p.index)
    .filter((p) => typeof p === "number");

  for (let i = 1; i <= 128; i++) {
    if (!indexes.includes(i)) {
      return i;
    }
  }

  return indexes.length + 1;
};

const CACHE_KEY = "olts_by_router";
const CACHE_TIMESTAMP_KEY = "olts_ts";
const CACHE_TTL = 5 * 60 * 1000;

// ─────────────────────────────────────────────────────────────
// REUSABLE COMPONENTS
// ─────────────────────────────────────────────────────────────
const ActionButton = ({ icon, title, variant, onClick, disabled, loading, size = "sm", className = "" }) => (
  <button
    className={`btn btn-outline-${variant} btn-${size} position-relative ${className}`}
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

const StatusBadge = ({ online }) => (
  <span className={`badge rounded-pill px-3 py-2 border ${
    online 
      ? "bg-success-subtle text-success border-success-subtle" 
      : "bg-secondary-subtle text-secondary border-secondary-subtle"
  }`}>
    <i className={`bi bi-circle-fill me-1 ${online ? "text-success" : "text-secondary"}`} style={{ fontSize: "0.6rem" }}></i>
    {online ? "Online" : "Offline"}
  </span>
);

const ConfirmDialog = ({ show, title, message, onConfirm, onCancel, confirmText = "Hapus", confirmVariant = "danger" }) => {
  if (!show) return null;
  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1060 }} onClick={onCancel}>
      <div className="modal-dialog modal-dialog-centered modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content border-0 shadow">
          <div className="modal-header border-bottom-0 pb-0">
            <h6 className="modal-title fw-semibold">{title}</h6>
            <button type="button" className="btn-close btn-close-sm" onClick={onCancel}></button>
          </div>
          <div className="modal-body py-3">
            <p className="mb-0 small text-muted">{message}</p>
          </div>
          <div className="modal-footer border-top-0 pt-0">
            <button className="btn btn-secondary btn-sm" onClick={onCancel}>Batal</button>
            <button className={`btn btn-${confirmVariant} btn-sm`} onClick={onConfirm}>{confirmText}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// OLT CARD COMPONENT
// ─────────────────────────────────────────────────────────────
const OltCard = ({ olt, routers, onEdit, onDelete, onAddPort, onDeletePort, onManagePort, onCreateOdc, onCreateChildOdc, onCreateOdp, onDeleteOdc, onDeleteOdp, onEditOdc, onEditOdp, portLoading }) => {
  const [showPorts, setShowPorts] = useState(true);
  const router = routers.find((r) => r.id === olt.routerId);
  const portCount = olt.ports?.length || olt._count?.ports || 0;
  const usedCount = olt.ports?.filter((p) => p._count?.nodes > 0 || p._count?.odcs > 0).length || 0;

  return (
    <div className="card border-0 shadow-sm mb-3">
      {/* OLT Header */}
      <div className="card-header bg-white py-3">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div className="d-flex align-items-center gap-3">
            <button 
              className="btn btn-sm p-0 text-primary"
              onClick={() => setShowPorts(!showPorts)}
              title={showPorts ? "Collapse" : "Expand"}
            >
              <i className={`bi bi-${showPorts ? "dash-square" : "plus-square"} fs-5`}></i>
            </button>
            <div>
              <h6 className="mb-1 fw-semibold text-dark">
                <i className="bi bi-hdd-network me-2 text-primary"></i>
                {olt.name}
              </h6>
              <small className="text-muted">
                Router: {router?.name} ({router?.host}) • 
                Coordinates: {olt.latitude && olt.longitude ? (
                  <a href={`https://maps.google.com/?q=${olt.latitude},${olt.longitude}`} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                    {formatCoordinate(olt.latitude)}, {formatCoordinate(olt.longitude)}
                  </a>
                ) : <span className="text-muted">-</span>}
              </small>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <StatusBadge online={router?.isOnline} />
            <span className="badge bg-secondary-subtle text-secondary">
              {usedCount}/{portCount} terpakai
            </span>
            <div className="vr mx-2"></div>
            <ActionButton icon="pencil" title="Edit OLT" variant="warning" onClick={() => onEdit(olt)} />
            <ActionButton icon="trash" title="Hapus OLT" variant="danger" onClick={() => onDelete(olt)} />
          </div>
        </div>
      </div>

      {/* Ports Section */}
      {showPorts && (
        <div className="card-body py-3" style={{ background: "#fafafa" }}>
          {/* Add Port Button */}
          <div className="mb-3">
            <button 
              className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2"
              onClick={() => onAddPort(olt)}
              disabled={!router?.isOnline}
              title={!router?.isOnline ? "Router offline" : "Tambah port baru"}
            >
              <i className="bi bi-plus-lg"></i>
              Tambah Port Otomatis
              {!router?.isOnline && <small className="text-muted ms-2">(Router Offline)</small>}
            </button>
          </div>

          {/* Ports List - Menggunakan PortItem Component */}
          {portCount === 0 ? (
            <div className="text-center text-muted py-4">
              <i className="bi bi-inbox fs-4 d-block mb-2"></i>
              <small>Belum ada port. Klik "Tambah Port Otomatis" untuk memulai.</small>
            </div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {(olt.ports || []).map((port) => {
                const isLoading = portLoading?.[port.id];
                return (
                  <PortItem
                    key={port.id}
                    port={port}
                    olt={olt}
                    onCreateOdc={onCreateOdc}
                    onCreateChildOdc={onCreateChildOdc}
                    onCreateOdp={onCreateOdp}
                    onDeleteOdc={onDeleteOdc}
                    onDeleteOdp={onDeleteOdp}
                    onEditOdc={onEditOdc}
                    onEditOdp={onEditOdp}
                    onDelete={!port._count?.nodes ? () => onDeletePort(port.id, olt.id) : undefined}
                    onManage={onManagePort}
                    loading={isLoading}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// OLT MODAL (Create/Edit)
// ─────────────────────────────────────────────────────────────
const OltModal = ({ show, onClose, onSubmit, initialData, routers, mode = "create" }) => {
  const [formData, setFormData] = useState({ routerId: "", name: "", latitude: "", longitude: "" });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        routerId: initialData.routerId || "",
        name: initialData.name || "",
        latitude: initialData.latitude || "",
        longitude: initialData.longitude || ""
      });
    } else {
      setFormData({ routerId: "", name: "", latitude: "", longitude: "" });
    }
    setErrors({});
  }, [initialData, show]);

  const validate = () => {
    const newErrors = {};
    if (!formData.routerId) newErrors.routerId = "Router wajib dipilih";
    if (!formData.name?.trim()) newErrors.name = "Nama OLT wajib diisi";
    if (formData.latitude === "" || formData.latitude === undefined || formData.latitude === null) {
      newErrors.latitude = "Koordinat latitude wajib ditentukan pada peta";
    } else if (isNaN(formData.latitude) || formData.latitude < -90 || formData.latitude > 90) {
      newErrors.latitude = "Latitude tidak valid (-90 hingga 90)";
    }
    if (formData.longitude === "" || formData.longitude === undefined || formData.longitude === null) {
      newErrors.longitude = "Koordinat longitude wajib ditentukan pada peta";
    } else if (isNaN(formData.longitude) || formData.longitude < -180 || formData.longitude > 180) {
      newErrors.longitude = "Longitude tidak valid (-180 hingga 180)";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await onSubmit({
        ...formData,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null
      });
      onClose();
    } catch (err) {
      setErrors({ submit: err.message || "Terjadi kesalahan" });
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1050 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content border-0 shadow">
          <form onSubmit={handleSubmit}>
            <div className="modal-header border-bottom-0 pb-0">
              <h6 className="modal-title fw-semibold">{mode === "create" ? "Tambah OLT Baru" : "Edit OLT"}</h6>
              <button type="button" className="btn-close btn-close-sm" onClick={onClose}></button>
            </div>
            <div className="modal-body py-3">
              {errors.submit && <div className="alert alert-danger py-2 small mb-3">{errors.submit}</div>}
              
              <div className="mb-3">
                <label className="form-label small fw-semibold">Router *</label>
                <select
                  className={`form-select form-select-sm ${errors.routerId ? "is-invalid" : ""}`}
                  value={formData.routerId}
                  onChange={(e) => setFormData(prev => ({ ...prev, routerId: Number(e.target.value) }))}
                  disabled={mode === "edit"}
                >
                  <option value="">Pilih Router</option>
                  {routers.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.host})</option>
                  ))}
                </select>
                {errors.routerId && <div className="invalid-feedback">{errors.routerId}</div>}
              </div>
              
              <div className="mb-3">
                <label className="form-label small fw-semibold">Nama OLT *</label>
                <input
                  type="text"
                  className={`form-control form-control-sm ${errors.name ? "is-invalid" : ""}`}
                  placeholder="Contoh: OLT-CISARUA-01"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
                {errors.name && <div className="invalid-feedback">{errors.name}</div>}
              </div>
              
              {/* MapPicker integration for OLT location */}
              <div className="mb-2">
                <label className="form-label small fw-semibold">
                  <i className="bi bi-geo-alt me-1 text-primary"></i>
                  Koordinat Lokasi OLT <span className="text-muted fw-normal">(opsional — klik peta atau tempel koordinat)</span>
                </label>
              </div>
              <div className="rounded-3 overflow-hidden border border-secondary-subtle shadow-sm mb-3">
                <MapPicker
                  key={`olt-map-${initialData?.id ?? 'new'}-${show}`}
                  lat={formData.latitude}
                  lng={formData.longitude}
                  height={250}
                  onChange={(lat, lng) =>
                    setFormData((p) => ({
                      ...p,
                      latitude: lat === "" ? "" : Number(lat).toFixed(7),
                      longitude: lng === "" ? "" : Number(lng).toFixed(7),
                    }))
                  }
                />
              </div>
              {errors.latitude && <div className="text-danger small mb-1">{errors.latitude}</div>}
              {errors.longitude && <div className="text-danger small mb-3">{errors.longitude}</div>}
            </div>
            <div className="modal-footer border-top-0 pt-0">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={loading}>Batal</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                {loading ? <><span className="spinner-border spinner-border-sm me-1" style={{width:"12px",height:"12px"}}></span>Menyimpan...</> : (mode === "create" ? "Tambah OLT" : "Simpan Perubahan")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function OltManagement() {
  /* ───────────────── STATE ───────────────── */
  const [routers, setRouters] = useState([]);
  const [oltsByRouter, setOltsByRouter] = useState({});
  const [selectedRouter, setSelectedRouter] = useState(null);
  
  /* ───────────────── UI STATE ───────────────── */
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [portLoading, setPortLoading] = useState({});
  
  /* ───────────────── MODAL STATES ───────────────── */
  const [showOltModal, setShowOltModal] = useState(false);
  const [showOdcModal, setShowOdcModal] = useState(false);
  const [showChildOdcModal, setShowChildOdcModal] = useState(false);
  const [showOdpModal, setShowOdpModal] = useState(false);
  const [showEditOdcModal, setShowEditOdcModal] = useState(false);   // ← NEW
  const [showEditOdpModal, setShowEditOdpModal] = useState(false);   // ← NEW
  const [editingOlt, setEditingOlt] = useState(null);
  const [editingOdc, setEditingOdc] = useState(null);               // ← NEW
  const [editingOdp, setEditingOdp] = useState(null);               // ← NEW
  const [selectedPortForOdc, setSelectedPortForOdc] = useState(null);
  const [selectedOltForOdc, setSelectedOltForOdc] = useState(null);
  const [selectedParentOdc, setSelectedParentOdc] = useState(null);
  const [selectedParentPort, setSelectedParentPort] = useState(null);
  // Callback fetchTree dari PortItem — dipanggil setelah ODC/ODP berhasil dibuat
  const fetchTreeCallbackRef = useRef(null);
  
  /* ───────────────── CONFIRM DIALOG ───────────────── */
  const [confirmDelete, setConfirmDelete] = useState({ show: false, olt: null, portId: null, oltId: null, routerId: null });
  
  /* ───────────────── REFS ───────────────── */
  const isMountedRef = useRef(true);

  /* ───────────────── LOAD DATA ───────────────── */
  const loadRouters = useCallback(async () => {
    const response = await api.get("/routers");
    return response.data || [];
  }, []);

  const loadOltsByRouter = useCallback(async (routerId) => {
    const response = await api.get(`/olts/olt/router/${routerId}`);
    return response.data?.data || [];
  }, []);

  const loadOltDetails = useCallback(async (oltId) => {
    const response = await api.get(`/olts/olt/${oltId}`);
    return response.data?.data;
  }, []);

  /* ───────────────── INIT ───────────────── */
  useEffect(() => {
    isMountedRef.current = true;
    
    const init = async () => {
      setLoading(true);
      try {
        const routersData = await loadRouters();
        if (!isMountedRef.current) return;
        setRouters(routersData);
        
        if (routersData.length > 0) {
          const defaultRouter = routersData[0].id;
          setSelectedRouter(defaultRouter);
          await loadRouterOlts(defaultRouter);
        }
      } catch (err) {
        console.error("Init error:", err);
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };
    init();
    return () => { isMountedRef.current = false; };
  }, [loadRouters]);

  /* ───────────────── LOAD OLTs FOR SELECTED ROUTER ───────────────── */
  const loadRouterOlts = useCallback(async (routerId) => {
    if (!routerId) return;
    setLoading(true);
    // Clear stale cache so fresh data is always shown after mutations
    try {
      sessionStorage.removeItem(CACHE_KEY);
      sessionStorage.removeItem(CACHE_TIMESTAMP_KEY);
    } catch (_) {}
    
    try {
      const olts = await loadOltsByRouter(routerId);
      const oltsWithPorts = await Promise.all(
        olts.map(async (olt) => {
          const details = await loadOltDetails(olt.id);
          return { ...olt, ports: details?.ports || [] };
        })
      );
      
      if (isMountedRef.current) {
        setOltsByRouter(prev => ({ ...prev, [routerId]: oltsWithPorts }));
      }
    } catch (err) {
      console.error("Failed to load OLTs:", err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [loadOltsByRouter, loadOltDetails]);

  useEffect(() => {
    if (selectedRouter) loadRouterOlts(selectedRouter);
  }, [selectedRouter, loadRouterOlts]);

  /* ───────────────── CRUD OPERATIONS ───────────────── */
  const handleCreateOlt = async (formData) => {
    const { data } = await api.post("/olts/olt", formData);
    await loadRouterOlts(formData.routerId);
    return data;
  };

  const handleUpdateOlt = async (formData) => {
    const { data } = await api.put(`/olts/olt/${editingOlt.id}`, formData);
    await loadRouterOlts(formData.routerId);
    return data;
  };

  const handleDeleteOlt = async () => {
    if (!confirmDelete.olt) return;
    const { id, routerId } = confirmDelete.olt;
    
    setActionLoading(prev => ({ ...prev, [`delete-olt-${id}`]: true }));
    try {
      await api.delete(`/olts/olt/${id}`);
      await loadRouterOlts(routerId);
    } catch (err) {
      alert("Gagal menghapus OLT: " + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [`delete-olt-${id}`]: false }));
      setConfirmDelete({ show: false, olt: null, portId: null, oltId: null, routerId: null });
    }
  };

const handleAddPort = async (olt) => {
  const nextPort = generateNextPort(olt.ports || []);

  try {
    await api.post(`/olts/olt/${olt.id}/ports`, {
      ports: [nextPort],
    });

    await loadRouterOlts(olt.routerId);

  } catch (err) {
    console.log(err.response?.data);
    alert(err.response?.data?.message || "Gagal tambah port");
  }
};

  const handleDeletePort = async (portId, oltId, routerId) => {
    setPortLoading(prev => ({ ...prev, [`delete-${portId}`]: true }));
    try {
      await api.delete(`/olts/olt/ports/${portId}`);
      await loadRouterOlts(routerId);
    } catch (err) {
      alert("Gagal menghapus port: " + err.message);
    } finally {
      setPortLoading(prev => ({ ...prev, [`delete-${portId}`]: false }));
      setConfirmDelete({ show: false, olt: null, portId: null, oltId: null, routerId: null });
    }
  };

  const handleManagePort = (item, type) => {
    if (type === 'odp') {
      alert(`ODP: ${item.name}\nKlik untuk detail lebih lanjut`);
    } else {
      alert(`Port ${item.port} pada ${item.olt?.name || 'OLT'}\nTerhubung ke ${item._count?.nodes || 0} ONU(s)`);
    }
  };

  // ─── Root ODC (dari OLT port) ───
  const handleOpenOdcForm = (port, olt) => {
    setSelectedPortForOdc(port);
    setSelectedOltForOdc(olt);
    setShowOdcModal(true);
  };
  const handleCreateOdc = async () => {
    // Root ODC: refresh OLT list agar isUsed port berubah
    if (selectedRouter) await loadRouterOlts(selectedRouter);
  };

  // ─── Child ODC (dari port ODC) ───
  // onCreateChildOdc dipanggil dari OdcPortRow dengan signature: (odc, port, fetchTree)
  const handleOpenChildOdcForm = (parentOdc, parentPort, fetchTreeCb) => {
    setSelectedParentOdc(parentOdc);
    setSelectedParentPort(parentPort);
    fetchTreeCallbackRef.current = fetchTreeCb ?? null;
    setShowChildOdcModal(true);
  };
  const handleCreateChildOdc = async () => {
    // Panggil fetchTree langsung agar tree update instan
    if (fetchTreeCallbackRef.current) {
      await fetchTreeCallbackRef.current();
      fetchTreeCallbackRef.current = null;
    }
  };

  // ─── ODP (dari port ODC) ───
  const handleOpenOdpForm = (parentOdc, parentPort, fetchTreeCb) => {
    setSelectedParentOdc(parentOdc);
    setSelectedParentPort(parentPort);
    fetchTreeCallbackRef.current = fetchTreeCb ?? null;
    setShowOdpModal(true);
  };
  const handleCreateOdp = async () => {
    if (fetchTreeCallbackRef.current) {
      await fetchTreeCallbackRef.current();
      fetchTreeCallbackRef.current = null;
    }
  };

  // ─── Hapus ODP ───
  const handleDeleteOdp = async (odp, fetchTreeCb) => {
    if (!window.confirm(`Hapus ODP "${odp.name}"? Pastikan tidak ada user aktif.`)) return;
    try {
      await api.delete(`/topology/odp/${odp.id}`);
      if (fetchTreeCb) await fetchTreeCb();
      else if (selectedRouter) await loadRouterOlts(selectedRouter);
    } catch (err) {
      alert("Gagal hapus ODP: " + (err.response?.data?.message || err.message));
    }
  };

  // ─── Hapus ODC ───
  const handleDeleteOdc = async (odc, fetchTreeCb) => {
    if (!window.confirm(`Hapus ODC "${odc.name}"? Semua child ODC dan ODP di dalamnya akan ikut terhapus.`)) return;
    try {
      await api.delete(`/topology/odc/${odc.id}`);
      if (fetchTreeCb) await fetchTreeCb();
      else if (selectedRouter) await loadRouterOlts(selectedRouter);
    } catch (err) {
      alert("Gagal hapus ODC: " + (err.response?.data?.message || err.message));
    }
  };

  // ─── Edit ODC ─── ← NEW
  const handleOpenEditOdcForm = (odc, fetchTreeCb) => {
    setEditingOdc(odc);
    fetchTreeCallbackRef.current = fetchTreeCb ?? null;
    setShowEditOdcModal(true);
  };
  const handleEditOdc = async () => {
    if (fetchTreeCallbackRef.current) {
      await fetchTreeCallbackRef.current();
      fetchTreeCallbackRef.current = null;
    }
  };

  // ─── Edit ODP ─── ← NEW
  const handleOpenEditOdpForm = (odp, fetchTreeCb) => {
    setEditingOdp(odp);
    fetchTreeCallbackRef.current = fetchTreeCb ?? null;
    setShowEditOdpModal(true);
  };
  const handleEditOdp = async () => {
    if (fetchTreeCallbackRef.current) {
      await fetchTreeCallbackRef.current();
      fetchTreeCallbackRef.current = null;
    }
  };

  /* ───────────────── FILTERED DATA ───────────────── */
  const currentOlts = useMemo(() => {
    return oltsByRouter[selectedRouter] || [];
  }, [oltsByRouter, selectedRouter]);

  const stats = useMemo(() => {
    const total = currentOlts.length;
    const online = currentOlts.filter(o => o.router?.isOnline).length;
    const totalPorts = currentOlts.reduce((sum, o) => sum + (o._count?.ports || o.ports?.length || 0), 0);
    return { total, online, totalPorts };
  }, [currentOlts]);

  /* ───────────────── MAIN RENDER ───────────────── */
  return (
    <>
      <style>{`
        .card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .card-hover:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin-anim { animation: spin 0.8s linear infinite; display: inline-block; }
      `}</style>

      <div className="container-fluid py-4" style={{ background: "#f8f9fa", minHeight: "100vh" }}>
        
        {/* ===== HEADER ===== */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
          <div>
            <h3 className="fw-bold mb-1">
              <i className="bi bi-hdd-network me-2 text-primary"></i>OLT Management
            </h3>
            <p className="text-muted mb-0 small">Kelola Optical Line Terminal per Router</p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-primary btn-sm d-flex align-items-center gap-2"
              onClick={() => { setEditingOlt(null); setShowOltModal(true); }}
            >
              <i className="bi bi-plus-lg"></i>
              <span className="d-none d-sm-inline">Tambah OLT</span>
            </button>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => selectedRouter && loadRouterOlts(selectedRouter)}
              disabled={loading}
            >
              <i className={`bi bi-arrow-clockwise ${loading ? "spinner-border spinner-border-sm" : ""}`}></i>
            </button>
          </div>
        </div>

        {/* ===== ROUTER SELECTOR & STATS ===== */}
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <label className="form-label small text-muted fw-semibold mb-2">Pilih Router</label>
                <select
                  className="form-select form-select-sm"
                  value={selectedRouter || ""}
                  onChange={(e) => setSelectedRouter(Number(e.target.value))}
                >
                  {routers.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} • {r.host}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          {[
            { label: "Total OLT", value: stats.total, icon: "hdd-network", color: "text-primary" },
            { label: "Router Online", value: stats.online, icon: "check-circle", color: "text-success" },
            { label: "Total Port", value: stats.totalPorts, icon: "plug", color: "text-info" },
          ].map((item) => (
            <div className="col-md" key={item.label}>
              <div className="card border-0 shadow-sm h-100 card-hover">
                <div className="card-body py-3">
                  <div className="d-flex align-items-center">
                    <div className={`fs-4 ${item.color} me-3`}><i className={`bi bi-${item.icon}`}></i></div>
                    <div>
                      <div className="small text-muted text-uppercase fw-semibold">{item.label}</div>
                      <div className="fs-4 fw-bold">{item.value}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ===== OLT LIST (GROUPED) ===== */}
        {loading && !currentOlts.length ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted mt-2">Memuat data...</p>
          </div>
        ) : !currentOlts.length ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body text-center py-5 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-3"></i>
              <p className="mb-0">Belum ada OLT pada router ini.</p>
              <button className="btn btn-primary btn-sm mt-3" onClick={() => setShowOltModal(true)}>
                <i className="bi bi-plus-lg me-1"></i>Tambah OLT Pertama
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {currentOlts.map((olt) => (
              <OltCard
                key={olt.id}
                olt={olt}
                routers={routers}
                onEdit={(o) => { setEditingOlt(o); setShowOltModal(true); }}
                onDelete={(o) => setConfirmDelete({ show: true, olt: o, portId: null, oltId: null, routerId: olt.routerId })}
                onAddPort={handleAddPort}
                onDeletePort={(portId, oltId) => setConfirmDelete({
                  show: true, olt: null, portId, oltId, routerId: olt.routerId
                })}
                onManagePort={handleManagePort}
                onCreateOdc={handleOpenOdcForm}
                onCreateChildOdc={handleOpenChildOdcForm}
                onCreateOdp={handleOpenOdpForm}
                onDeleteOdc={handleDeleteOdc}
                onDeleteOdp={handleDeleteOdp}
                onEditOdc={handleOpenEditOdcForm}
                onEditOdp={handleOpenEditOdpForm}
                portLoading={portLoading}
              />
            ))}
          </div>
        )}

        {/* ===== MODALS ===== */}
        <OltModal
          show={showOltModal}
          onClose={() => { setShowOltModal(false); setEditingOlt(null); }}
          onSubmit={editingOlt ? handleUpdateOlt : handleCreateOlt}
          initialData={editingOlt}
          routers={routers}
          mode={editingOlt ? "edit" : "create"}
        />

        {/* Root ODC Form */}
        <OdcForm
          show={showOdcModal}
          onClose={() => { setShowOdcModal(false); setSelectedPortForOdc(null); setSelectedOltForOdc(null); }}
          onSubmit={handleCreateOdc}
          initialPort={selectedPortForOdc}
          olt={selectedOltForOdc}
        />

        {/* Child ODC Form */}
        <OdcForm
          show={showChildOdcModal}
          onClose={() => { setShowChildOdcModal(false); setSelectedParentOdc(null); setSelectedParentPort(null); }}
          onSubmit={handleCreateChildOdc}
          parentOdc={selectedParentOdc}
          parentPort={selectedParentPort}
        />

        {/* Edit ODC Form */}
        <OdcForm
          show={showEditOdcModal}
          onClose={() => { setShowEditOdcModal(false); setEditingOdc(null); }}
          onSubmit={handleEditOdc}
          editingOdc={editingOdc}
        />

        {/* ODP Form */}
        <OdpForm
          show={showOdpModal}
          onClose={() => { setShowOdpModal(false); setSelectedParentOdc(null); setSelectedParentPort(null); }}
          onSubmit={handleCreateOdp}
          parentOdc={selectedParentOdc}
          parentPort={selectedParentPort}
        />

        {/* Edit ODP Form */}
        <OdpForm
          show={showEditOdpModal}
          onClose={() => { setShowEditOdpModal(false); setEditingOdp(null); }}
          onSubmit={handleEditOdp}
          editingOdp={editingOdp}
        />

        {/* Delete OLT Confirmation */}
        <ConfirmDialog
          show={confirmDelete.show && confirmDelete.olt}
          title="Konfirmasi Hapus OLT"
          message={`Hapus OLT "${confirmDelete.olt?.name}"? Semua port akan ikut terhapus.`}
          onConfirm={handleDeleteOlt}
          onCancel={() => setConfirmDelete({ show: false, olt: null, portId: null, oltId: null, routerId: null })}
        />

        {/* Delete Port Confirmation */}
        <ConfirmDialog
          show={confirmDelete.show && confirmDelete.portId}
          title="Konfirmasi Hapus Port"
          message={`Hapus port ini? Tindakan ini tidak dapat dibatalkan.`}
          onConfirm={() => handleDeletePort(confirmDelete.portId, confirmDelete.oltId, confirmDelete.routerId)}
          onCancel={() => setConfirmDelete({ show: false, olt: null, portId: null, oltId: null, routerId: null })}
        />

        {/* Footer */}
        <div className="text-center text-muted small mt-4 pb-3">
          <i className="bi bi-shield-check me-1"></i>OLT Management • Network Operations
        </div>
      </div>
    </>
  );
}