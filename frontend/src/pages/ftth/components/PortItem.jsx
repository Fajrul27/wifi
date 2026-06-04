import { useState, useEffect, useCallback } from "react";
import api from "../../../services/api";

const globalOdcTreeCache = {};
const globalOdcTreeLoading = {};

// ─────────────────────────────────────────────────────────────
// UTIL
// ─────────────────────────────────────────────────────────────
const SPLIT_LABEL = {
  ONE_TO_2: "1:2", ONE_TO_4: "1:4", ONE_TO_8: "1:8",
  ONE_TO_16: "1:16", ONE_TO_32: "1:32", ONE_TO_64: "1:64",
};

const fmtCoord = (v) => (v !== null && v !== undefined ? parseFloat(v).toFixed(4) : null);

// ─────────────────────────────────────────────────────────────
// LOCATION BADGE — clickable chip with Maps link
// ─────────────────────────────────────────────────────────────
const LocationBadge = ({ lat, lng }) => {
  if (lat == null || lng == null) {
    return (
      <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle"
        style={{ fontSize: "0.6rem" }}>
        <i className="bi bi-geo-alt me-1" />Belum ada lokasi
      </span>
    );
  }
  return (
    <a
      href={`https://maps.google.com/?q=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className="badge bg-success-subtle text-success border border-success-subtle text-decoration-none"
      style={{ fontSize: "0.6rem" }}
      title={`Lat: ${lat}, Lng: ${lng}`}
      onClick={(e) => e.stopPropagation()}
    >
      <i className="bi bi-geo-alt-fill me-1" />
      {fmtCoord(lat)}, {fmtCoord(lng)}
    </a>
  );
};

// ─────────────────────────────────────────────────────────────
// CONFIRM DIALOG
// ─────────────────────────────────────────────────────────────
const ConfirmDialog = ({ show, title, message, onConfirm, onCancel }) => {
  if (!show) return null;
  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1080 }} onClick={onCancel}>
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
            <button className="btn btn-danger btn-sm" onClick={onConfirm}>Lepas</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// ASSIGN USER MODAL
// ─────────────────────────────────────────────────────────────
const AssignUserModal = ({ show, onClose, odp, odpPort, routerId, onSuccess }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show || !routerId) return;
    setLoading(true); setSearch(""); setSelected(null); setError("");
    api.get(`/topology/users/${routerId}`)
      .then(res => setUsers((res.data?.data ?? []).filter(u => !u.odpPortId)))
      .catch(err => setError(err.response?.data?.message || "Gagal load users"))
      .finally(() => setLoading(false));
  }, [show, routerId]);

  const handleAssign = async () => {
    if (!selected) return;
    setSubmitting(true); setError("");
    try {
      const rawOdpId = odp.id;
      const realId = rawOdpId >= 100000 ? rawOdpId - 100000 : rawOdpId;
      await api.post(`/topology/odp/${realId}/assign`, { userId: selected.id, odpPortId: odpPort.id });
      onSuccess?.(); onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Gagal assign user");
    } finally { setSubmitting(false); }
  };

  if (!show) return null;
  const filtered = users.filter(u => u.username?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="modal fade show d-block" tabIndex="-1"
      style={{ background: "rgba(0,0,0,0.55)", zIndex: 1070 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-content border-0 shadow">
          <div className="modal-header py-2">
            <h6 className="modal-title fw-semibold" style={{ fontSize: "0.85rem" }}>
              <i className="bi bi-person-plus me-2 text-success" />
              Assign User → Port #{odpPort?.index}
            </h6>
            <button className="btn-close btn-close-sm" onClick={onClose} disabled={submitting} />
          </div>
          <div className="modal-body py-2">
            {error && <div className="alert alert-danger py-1 small mb-2">{error}</div>}
            <div className="text-muted small mb-2">ODP: <strong>{odp?.name}</strong></div>
            <input type="text" className="form-control form-control-sm mb-2"
              placeholder="Cari username..." value={search}
              onChange={e => setSearch(e.target.value)} autoFocus />
            {loading ? (
              <div className="text-center py-2"><span className="spinner-border spinner-border-sm text-primary" /></div>
            ) : (
              <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                {filtered.length === 0
                  ? <small className="text-muted d-block text-center py-2">Tidak ada user tersedia</small>
                  : filtered.map(u => (
                    <div key={u.id}
                      className={`d-flex align-items-center gap-2 px-2 py-1 rounded mb-1 border ${selected?.id === u.id ? "bg-success-subtle border-success" : "bg-light border-transparent"}`}
                      style={{ cursor: "pointer", fontSize: "0.78rem" }}
                      onClick={() => setSelected(u)}>
                      <i className={`bi bi-circle${u.isOnline ? "-fill text-success" : " text-muted"}`} style={{ fontSize: "0.5rem" }} />
                      <span className="fw-medium">{u.username}</span>
                      {u.profile && <span className="text-muted ms-auto">• {u.profile}</span>}
                    </div>
                  ))}
              </div>
            )}
          </div>
          <div className="modal-footer py-2 gap-2">
            <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>Batal</button>
            <button className="btn btn-success btn-sm" onClick={handleAssign} disabled={!selected || submitting}>
              {submitting ? <><span className="spinner-border spinner-border-sm me-1" style={{ width: "10px", height: "10px" }} />Menyimpan...</> : "Assign"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// ODP ITEM
// ─────────────────────────────────────────────────────────────
const OdpItem = ({ odp, routerId, onDeleteOdp, onEditOdp, onRefresh, parentPath }) => {
  const [expanded, setExpanded] = useState(true);
  const [assignModal, setAssignModal] = useState({ show: false, port: null });
  const [unassignConfirm, setUnassignConfirm] = useState({ show: false, port: null });
  const usedPorts = odp.ports?.filter(p => p.isUsed).length ?? 0;
  const totalPorts = odp.ports?.length ?? 0;

  const handleUnassign = (port) => {
    const userId = port.user?.id ?? port.userId;
    if (!userId) { 
      alert("ID user tidak ditemukan. Coba refresh halaman.");
      return; 
    }
    setUnassignConfirm({ show: true, port });
  };

  const handleUnassignConfirm = async () => {
    const port = unassignConfirm.port;
    if (!port) return;
    const userId = port.user?.id ?? port.userId;
    if (!userId) return;

    setUnassignConfirm({ show: false, port: null });
    try {
      await api.post(`/topology/odp/unassign/${userId}`);
      onRefresh?.();
    } catch (err) { 
      alert("Gagal unassign: " + (err.response?.data?.message || err.message)); 
    }
  };

  return (
    <div style={{ marginLeft: "16px", borderLeft: "2px dashed #0dcaf0", paddingLeft: "10px", marginTop: "6px" }}>
      <AssignUserModal show={assignModal.show} onClose={() => setAssignModal({ show: false, port: null })}
        odp={odp} odpPort={assignModal.port} routerId={routerId} onSuccess={onRefresh} />

      <ConfirmDialog 
        show={unassignConfirm.show}
        title="Lepas User dari Port"
        message={`Apakah Anda yakin ingin melepas "${unassignConfirm.port?.user?.username || `User Port #${unassignConfirm.port?.index}`}" dari Port #${unassignConfirm.port?.index} di ${odp.name}?`}
        onConfirm={handleUnassignConfirm}
        onCancel={() => setUnassignConfirm({ show: false, port: null })}
      />

      <div id={`odp-${odp.id}`} className="card border-0 shadow-sm mb-1 transition-all" style={{ fontSize: "0.78rem" }}>
        {/* ODP Header */}
        <div className="d-flex align-items-center justify-content-between px-2 py-1"
          style={{ background: "linear-gradient(90deg,#e0f7fa,#f0fdff)", borderRadius: "6px 6px 0 0", cursor: "pointer" }}
          onClick={() => setExpanded(!expanded)}>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <i className={`bi bi-${expanded ? "dash-square" : "plus-square"} text-info`} />
            <i className="bi bi-boxes text-info" />
            <span className="fw-semibold text-info">{odp.name}</span>
            {parentPath && (
              <span className="text-muted small px-1.5 py-0.5 rounded bg-light border border-light-subtle d-inline-flex align-items-center gap-1 ms-1" style={{ fontSize: "0.62rem" }}>
                <i className="bi bi-diagram-2 text-secondary" style={{ fontSize: "0.58rem" }} />
                {parentPath}
              </span>
            )}
            <span className="badge bg-info text-white" style={{ fontSize: "0.65rem" }}>
              {SPLIT_LABEL[odp.splitRatio] ?? odp.splitRatio}
            </span>
            <span className={`badge ${usedPorts === totalPorts && totalPorts > 0 ? "bg-danger-subtle text-danger" : usedPorts > 0 ? "bg-warning-subtle text-warning" : "bg-success-subtle text-success"}`}
              style={{ fontSize: "0.65rem" }}>
              {usedPorts}/{totalPorts} port
            </span>
            {/* Location badge */}
            <LocationBadge lat={odp.latitude} lng={odp.longitude} />
          </div>
          <div className="d-flex gap-1" onClick={e => e.stopPropagation()}>
            {onEditOdp && (
              <button className="btn btn-sm btn-outline-warning py-0 px-1" title="Edit Lokasi ODP"
                onClick={() => onEditOdp(odp)}>
                <i className="bi bi-pencil" style={{ fontSize: "0.65rem" }} />
              </button>
            )}
            {onDeleteOdp && (
              <button className="btn btn-sm btn-outline-danger py-0 px-1" title="Hapus ODP"
                onClick={() => onDeleteOdp(odp)}>
                <i className="bi bi-trash" style={{ fontSize: "0.65rem" }} />
              </button>
            )}
          </div>
        </div>

        {/* ODP Ports */}
        {expanded && (
          <div className="px-2 py-2">
            <div className="d-flex flex-wrap gap-1">
              {(odp.ports ?? []).map(port => (
                <button key={port.id}
                  id={port.isUsed && port.user?.id ? `user-${port.user.id}` : `odp-port-${port.id}`}
                  className={`btn btn-sm py-1 px-2 ${port.isUsed ? "btn-success" : "btn-outline-secondary"}`}
                  style={{ fontSize: "0.68rem", lineHeight: 1.3, minWidth: "52px" }}
                  title={port.isUsed ? `${port.user?.username ?? "Terpakai"} — klik untuk lepas` : `Port #${port.index} — klik untuk assign`}
                  onClick={() => port.isUsed ? handleUnassign(port) : setAssignModal({ show: true, port })}>
                  <i className={`bi bi-${port.isUsed ? "person-fill" : "person-plus"}`} />
                  <span className="ms-1">#{port.index}</span>
                  {port.isUsed && port.user && (
                    <span className="d-block" style={{ fontSize: "0.58rem", opacity: 0.9 }}>{port.user.username}</span>
                  )}
                </button>
              ))}
              {totalPorts === 0 && <small className="text-muted fst-italic">Belum ada port</small>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// ODC PORT ROW — satu baris port ODC
// ─────────────────────────────────────────────────────────────
const OdcPortRow = ({ port, odc, level, onAddChildOdc, onAddOdp, onDeleteOdc, onDeleteOdp, onEditOdc, onEditOdp, childOdcMap, routerId, onRefresh, parentPath }) => {
  const isODC = port.connectionType === "ODC";
  const isODP = port.connectionType === "ODP";
  const isFree = port.connectionType === "NONE";
  const childOdc = isODC && port.connectedOdcId ? childOdcMap[port.connectedOdcId] : null;
  const connectedOdp = isODP && port.connectedOdp ? port.connectedOdp : null;

  return (
    <div className="mb-1">
      <div className={`d-flex align-items-center justify-content-between rounded px-2 py-1 border ${
        isODC ? "bg-primary-subtle border-primary-subtle" :
        isODP ? "bg-info-subtle border-info-subtle" :
        "bg-white border-secondary-subtle"
      }`} style={{ fontSize: "0.76rem" }}>
        <div className="d-flex align-items-center gap-2">
          <i className={`bi bi-${isODC ? "diagram-3-fill text-primary" : isODP ? "boxes text-info" : "circle text-muted"}`} />
          <span className={`fw-semibold ${isODC ? "text-primary" : isODP ? "text-info" : "text-muted"}`}>
            Port #{port.index}
          </span>
          {!isFree && (
            <span className={`badge ${isODC ? "bg-primary" : "bg-info text-white"}`} style={{ fontSize: "0.6rem" }}>
              {port.connectionType}
            </span>
          )}
          {isFree && <span className="badge bg-light text-muted border" style={{ fontSize: "0.6rem" }}>Kosong</span>}
        </div>

        {isFree && (
          <div className="d-flex gap-1">
            <button className="btn btn-outline-primary py-0 px-2" style={{ fontSize: "0.62rem" }}
              onClick={() => onAddChildOdc?.(odc, port, onRefresh)} title="Pasang ODC">
              <i className="bi bi-diagram-3-fill" /> ODC
            </button>
            <button className="btn btn-outline-info py-0 px-2" style={{ fontSize: "0.62rem" }}
              onClick={() => onAddOdp?.(odc, port, onRefresh)} title="Pasang ODP">
              <i className="bi bi-boxes" /> ODP
            </button>
          </div>
        )}
      </div>

      {childOdc && (
        <OdcTreeItem odc={childOdc} level={level + 1}
          onAddChildOdc={onAddChildOdc} onAddOdp={onAddOdp}
          onDeleteOdc={onDeleteOdc} onDeleteOdp={onDeleteOdp}
          onEditOdc={onEditOdc} onEditOdp={onEditOdp}
          childOdcMap={childOdcMap} routerId={routerId} onRefresh={onRefresh}
          parentPath={`${parentPath} • Port #${port.index}`} />
      )}
      {connectedOdp && (
        <OdpItem odp={connectedOdp} routerId={routerId}
          onDeleteOdp={onDeleteOdp}
          onEditOdp={onEditOdp}
          onRefresh={onRefresh}
          parentPath={`${parentPath} • Port #${port.index}`} />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// ODC TREE ITEM — rekursif
// ─────────────────────────────────────────────────────────────
const OdcTreeItem = ({ odc, level = 0, onAddChildOdc, onAddOdp, childOdcMap, routerId, onRefresh, onDeleteOdc, onDeleteOdp, onEditOdc, onEditOdp, parentPath }) => {
  const [expanded, setExpanded] = useState(true);
  const usedPorts = odc.ports?.filter(p => p.isUsed).length ?? 0;
  const totalPorts = odc.ports?.length ?? 0;

  const localMap = { ...childOdcMap };
  const addAll = (node) => {
    if (!node.children) return;
    for (const c of node.children) { localMap[c.id] = c; addAll(c); }
  };
  if (odc.children) { for (const c of odc.children) { localMap[c.id] = c; addAll(c); } }

  const indent = Math.min(level * 12, 48);

  return (
    <div style={{ marginLeft: `${indent}px`, marginTop: "6px",
      borderLeft: level > 0 ? "2px dashed #adb5bd" : "none",
      paddingLeft: level > 0 ? "10px" : "0" }}>
      <div id={`odc-${odc.id}`} className="card border-0 shadow-sm transition-all" style={{ fontSize: "0.8rem" }}>
        {/* ODC Header */}
        <div className="d-flex align-items-center justify-content-between px-2 py-1"
          style={{ background: "linear-gradient(90deg,#e8f0fe,#f0f4ff)", borderRadius: "6px 6px 0 0", cursor: "pointer" }}
          onClick={() => setExpanded(!expanded)}>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <i className={`bi bi-${expanded ? "dash-square" : "plus-square"} text-primary`} />
            <i className="bi bi-diagram-3-fill text-primary" />
            <span className="fw-bold text-primary">{odc.name}</span>
            {parentPath && (
              <span className="text-muted small px-1.5 py-0.5 rounded bg-light border border-light-subtle d-inline-flex align-items-center gap-1 ms-1" style={{ fontSize: "0.62rem" }}>
                <i className="bi bi-diagram-2 text-secondary" style={{ fontSize: "0.58rem" }} />
                {parentPath}
              </span>
            )}
            <span className="badge bg-primary" style={{ fontSize: "0.62rem" }}>
              {SPLIT_LABEL[odc.splitRatio] ?? odc.splitRatio}
            </span>
            <span className={`badge ${usedPorts === totalPorts && totalPorts > 0 ? "bg-danger-subtle text-danger border border-danger-subtle" : usedPorts > 0 ? "bg-warning-subtle text-warning border border-warning-subtle" : "bg-success-subtle text-success border border-success-subtle"}`}
              style={{ fontSize: "0.62rem" }}>
              {usedPorts}/{totalPorts} port
            </span>
            {/* Location badge */}
            <LocationBadge lat={odc.latitude} lng={odc.longitude} />
          </div>
          <div className="d-flex gap-1" onClick={e => e.stopPropagation()}>
            {onEditOdc && (
              <button className="btn btn-sm btn-outline-warning py-0 px-1" title="Edit Lokasi ODC"
                onClick={() => onEditOdc(odc)}>
                <i className="bi bi-pencil" style={{ fontSize: "0.65rem" }} />
              </button>
            )}
            {onDeleteOdc && (
              <button className="btn btn-sm btn-outline-danger py-0 px-1" title="Hapus ODC"
                onClick={() => onDeleteOdc(odc)}>
                <i className="bi bi-trash" style={{ fontSize: "0.65rem" }} />
              </button>
            )}
          </div>
        </div>

        {/* ODC Ports */}
        {expanded && (
          <div className="px-2 py-2" style={{ background: "#fafbff" }}>
            {totalPorts === 0
              ? <small className="text-muted fst-italic">Tidak ada port</small>
              : (odc.ports ?? []).map(port => (
                <OdcPortRow key={port.id} port={port} odc={odc} level={level}
                  onAddChildOdc={onAddChildOdc} onAddOdp={onAddOdp}
                  onDeleteOdc={onDeleteOdc} onDeleteOdp={onDeleteOdp}
                  onEditOdc={onEditOdc} onEditOdp={onEditOdp}
                  childOdcMap={localMap} routerId={routerId} onRefresh={onRefresh}
                  parentPath={parentPath ? `${parentPath} • ${odc.name}` : odc.name} />
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN PORT ITEM (OLT Port)
// ─────────────────────────────────────────────────────────────
export default function PortItem({
  port, olt,
  onCreateOdc,       // (port, olt) → buka form root ODC
  onCreateChildOdc,  // (parentOdc, parentPort, fetchTree) → buka form child ODC
  onCreateOdp,       // (parentOdc, parentPort, fetchTree) → buka form ODP
  onDeleteOdc,       // (odc, fetchTree) → hapus ODC
  onDeleteOdp,       // (odp, fetchTree) → hapus ODP
  onEditOdc,         // (odc, fetchTree) → edit ODC ← NEW
  onEditOdp,         // (odp, fetchTree) → edit ODP ← NEW
  onDelete,
  loading,
  expanded: propExpanded,
  onToggleExpand: propOnToggle,
}) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = propExpanded !== undefined ? propExpanded : localExpanded;
  const setExpanded = propOnToggle !== undefined ? propOnToggle : setLocalExpanded;
  const [odcTree, setOdcTree] = useState(() => globalOdcTreeCache[port?.id] || []);
  const [loadingTree, setLoadingTree] = useState(() => port?.id && globalOdcTreeLoading[port.id]);

  const isUsed = port?.isUsed === true || (port?._count?.odcs ?? 0) > 0;

  const fetchTree = useCallback(async (force = false) => {
    if (!port?.id) return;
    
    // Don't refetch if we already have it in cache unless forced (refresh)
    if (!force && globalOdcTreeCache[port.id]) {
      setOdcTree(globalOdcTreeCache[port.id]);
      return;
    }
    
    setLoadingTree(true);
    globalOdcTreeLoading[port.id] = true;

    // Stagger the initial load based on port index to prevent backend timeout (API storm)
    if (!force) {
      await new Promise(resolve => setTimeout(resolve, (port.index % 50) * 150));
      // Check cache again in case another instance loaded it
      if (globalOdcTreeCache[port.id]) {
        setOdcTree(globalOdcTreeCache[port.id]);
        setLoadingTree(false);
        globalOdcTreeLoading[port.id] = false;
        return;
      }
    }

    try {
      const res = await api.get(`/topology/odc/tree/${port.id}`);
      const data = res.data?.data ?? [];
      setOdcTree(data);
      globalOdcTreeCache[port.id] = data;
    } catch (err) {
      console.error("Gagal load ODC tree:", err.response?.data || err);
      if (!globalOdcTreeCache[port.id]) setOdcTree([]);
    } finally { 
      setLoadingTree(false); 
      globalOdcTreeLoading[port.id] = false;
    }
  }, [port?.id, port?.index]);

  // Auto-expand jika port terpakai
  useEffect(() => {
    if (isUsed && !expanded) setExpanded(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUsed]);

  useEffect(() => {
    if (expanded) fetchTree();
  }, [expanded, fetchTree]);

  // Build flat map
  const buildMap = (nodes) => {
    const map = {};
    const go = (list) => { for (const n of list) { map[n.id] = n; if (n.children) go(n.children); } };
    go(nodes); return map;
  };
  const childOdcMap = buildMap(odcTree);

  return (
    <div className={`rounded-3 mb-2 border ${isUsed ? "border-primary-subtle" : "border-secondary-subtle"}`}
      style={{ background: isUsed ? "#f5f8ff" : "#fff" }}>

      {/* OLT PORT HEADER */}
      <div className="d-flex justify-content-between align-items-center px-3 py-2">
        <div className="d-flex align-items-center gap-2">
          <div className={`rounded-circle d-flex align-items-center justify-content-center ${isUsed ? "bg-primary" : "bg-secondary-subtle"}`}
            style={{ width: 26, height: 26 }}>
            <i className={`bi bi-plug${isUsed ? "-fill text-white" : " text-secondary"}`} style={{ fontSize: "0.7rem" }} />
          </div>
          <span className={`fw-semibold ${isUsed ? "text-primary" : "text-muted"}`} style={{ fontSize: "0.85rem" }}>
            PORT {port?.index}
          </span>
          {isUsed
            ? <span className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: "0.68rem" }}>Terpakai</span>
            : <span className="badge bg-secondary-subtle text-secondary border" style={{ fontSize: "0.68rem" }}>Kosong</span>
          }
        </div>

        <div className="d-flex gap-1">
          {/* Tombol pasang ODC (hanya jika kosong) */}
          {!isUsed && (
            <button className="btn btn-sm btn-outline-primary" style={{ fontSize: "0.7rem" }}
              onClick={() => onCreateOdc?.(port, olt)} disabled={loading}
              title="Pasang ODC ke port OLT ini">
              <i className="bi bi-diagram-3" /> ODC
            </button>
          )}
          {/* Toggle tree */}
          <button className={`btn btn-sm ${expanded ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setExpanded(!expanded)} title={expanded ? "Tutup tree" : "Lihat topology"}>
            <i className={`bi bi-chevron-${expanded ? "up" : "down"}`} />
          </button>
          {/* Refresh */}
          {expanded && (
            <button className="btn btn-sm btn-outline-secondary" onClick={() => fetchTree(true)}
              disabled={loadingTree} title="Refresh tree">
              <i className={`bi bi-arrow-clockwise${loadingTree ? " spin-anim" : ""}`} />
            </button>
          )}
          {/* Delete port (hanya jika kosong) */}
          {!isUsed && (
            <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete?.()} title="Hapus port">
              <i className="bi bi-trash" />
            </button>
          )}
        </div>
      </div>

      {/* TREE AREA */}
      {expanded && (
        <div className="border-top px-3 py-2" style={{ background: "#f9fafb" }}>
          {loadingTree && odcTree.length === 0 ? (
            <div className="d-flex align-items-center gap-2 py-2">
              <span className="spinner-border spinner-border-sm text-primary" />
              <small className="text-muted">Memuat topology...</small>
            </div>
          ) : odcTree.length === 0 ? (
            <div className="text-center py-3">
              <i className="bi bi-diagram-3 text-muted d-block mb-1" style={{ fontSize: "1.5rem" }} />
              <small className="text-muted">Belum ada ODC. Klik tombol <strong>ODC</strong> di atas untuk pasang.</small>
            </div>
          ) : (
            <>
              {odcTree.map(odc => (
                <OdcTreeItem
                  key={odc.id} odc={odc} level={0}
                  onAddChildOdc={onCreateChildOdc}
                  onAddOdp={onCreateOdp}
                  onDeleteOdc={(o) => onDeleteOdc?.(o, () => fetchTree(true))}
                  onDeleteOdp={(o) => onDeleteOdp?.(o, () => fetchTree(true))}
                  onEditOdc={(o) => onEditOdc?.(o, () => fetchTree(true))}
                  onEditOdp={(o) => onEditOdp?.(o, () => fetchTree(true))}
                  childOdcMap={childOdcMap}
                  routerId={olt?.routerId}
                  onRefresh={() => fetchTree(true)}
                  parentPath={`${olt.name} • Port #${port.index}`}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}