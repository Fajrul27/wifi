import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import api from "../../services/api";
import { useRouterMonitor } from "./components/RouterMonitor";
import {
  usePppoeUserMonitor,
  StatusBadge,
  ConnectionBadge,
  formatTraffic,
} from "./components/PppoeUserMonitor";
import AddSecret from "./components/AddSecret";
import EditSecret from "./components/EditSecret";
import LocationModal from "./components/EditLocation";
import { useGlobalRealtime } from "../../context/GlobalRealtimeContext";
// ─────────────────────────────────────────────────────────────
// CONFIG & UTILS
// ─────────────────────────────────────────────────────────────
const safeNumber = (v) => (isNaN(Number(v)) ? 0 : Number(v));
const formatPercent = (v) => `${safeNumber(v).toFixed(1)}%`;

// Pagination config
const ITEMS_PER_PAGE_OPTIONS = [25, 50, 100, 250];
const DEFAULT_ITEMS_PER_PAGE = 50;

const formatDuration = (ms = 0) => {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const parseDuration = (value = "") => {
  if (!value || value === "-") return 0;
  const text = String(value);
  let total = 0;
  const days = text.match(/(\d+)\s*d/);
  const hours = text.match(/(\d+)\s*h/);
  const minutes = text.match(/(\d+)\s*m/);
  const seconds = text.match(/(\d+)\s*s/);
  if (days) total += Number(days[1]) * 86400;
  if (hours) total += Number(hours[1]) * 3600;
  if (minutes) total += Number(minutes[1]) * 60;
  if (seconds) total += Number(seconds[1]);
  return total * 1000;
};

const getLiveSessionDuration = (user, now) => {
  if (user?.isOnline) {
    const baseMs = parseDuration(user.uptime);
    const elapsedMs = user.realtimeUpdatedAt ? now - Number(user.realtimeUpdatedAt) : 0;
    return baseMs > 0 ? formatDuration(baseMs + elapsedMs) : (user.uptime || "-");
  }

  const baseTime = user?.lastDisconnect || user?.lastSeen || user?.createdAt;
  const baseDate = baseTime ? new Date(baseTime) : null;
  if (baseDate && !isNaN(baseDate)) return formatDuration(now - baseDate.getTime());
  return user?.downtime || "-";
};

// ─────────────────────────────────────────────────────────────
// REUSABLE COMPONENTS
// ─────────────────────────────────────────────────────────────
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

const ConfirmDialog = ({ show, title, message, onConfirm, onCancel }) => {
  if (!show) return null;
  return (
    <div 
      className="modal fade show d-block" 
      tabIndex="-1" 
      style={{ background: "rgba(0,0,0,0.5)", zIndex: 1060 }}
      onClick={onCancel}
    >
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
            <button className="btn btn-danger btn-sm" onClick={onConfirm}>Hapus</button>
          </div>
        </div>
      </div>
    </div>
  );
};

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

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function PppoeDashboard() {
  /* ───────────────── STATE ───────────────── */
  const {
    selectedRouter,
    setSelectedRouter,
    routers,
    isRouterLocked,
    setIsRouterLocked,
    setPppoeUsers
  } = useGlobalRealtime();

  /* ───────────────── PAGINATION STATE ───────────────── */
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);

  /* ───────────────── UI STATE (dari hook) ───────────────── */
  const {
    usersLoading,
    loadUsers,
    filteredUsers,
    onlineUsers,

    searchQuery,
    setSearchQuery,
    filterStatus,
    setFilterStatus,
    locationFilter,
    setLocationFilter,
    sortBy,
    setSortBy,
  } = usePppoeUserMonitor(selectedRouter);

  /* ───────────────── MODAL STATES ───────────────── */
  const [showAddModal, setShowAddModal] = useState(false);
  const [locationUser, setLocationUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  /* ───────────────── ACTION STATES ───────────────── */
  const [actionLoading, setActionLoading] = useState({});
  const [animatingRows, setAnimatingRows] = useState({});
  const [confirmDelete, setConfirmDelete] = useState({ show: false, user: null });
  const [liveNow, setLiveNow] = useState(Date.now());

  /* ───────────────── ROUTER MONITOR ───────────────── */
  const { loadRouters, metrics, socketConnected, isRouterConnected } = useRouterMonitor(selectedRouter);

  /* ───────────────── REFS ───────────────── */
  const isMountedRef = useRef(true);

  /* ───────────────── INIT ROUTERS ───────────────── */
  useEffect(() => {
    isMountedRef.current = true;
    const init = async () => {
      await loadRouters();
    };
    init();
    return () => { isMountedRef.current = false; };
  }, [loadRouters]);

  /* ───────────────── LOAD USERS ───────────────── */
  useEffect(() => {
    if (!selectedRouter) return;

    // Reset pagination when filters change
    setCurrentPage(1);
    
    // GlobalRealtimeContext handles fetching and caching in the background automatically.
  }, [selectedRouter]);

  /* ───────────────── RESET PAGE ON FILTER CHANGE ───────────────── */
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, locationFilter, sortBy]);

  useEffect(() => {
    const timer = setInterval(() => setLiveNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  /* ───────────────── SYNC ───────────────── */
  const handleSync = async () => {
    if (!selectedRouter) return;
    try {
      await api.post(`/pppoe/${selectedRouter}/sync`);
      await loadUsers(selectedRouter);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Sync failed");
    }
  };

  /* ───────────────── LOCATION MODAL ───────────────── */

  const openLocationModal = (user) => {
    setLocationUser(user);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setShowEditModal(true);
  };


  /* ───────────────── ANIMATION HELPERS ───────────────── */
  const triggerRowAnimation = useCallback((userId) => {
    setAnimatingRows(prev => ({ ...prev, [userId]: true }));
    setTimeout(() => setAnimatingRows(prev => ({ ...prev, [userId]: false })), 600);
  }, []);

  /* ───────────────── DELETE HANDLER ───────────────── */
  const handleDelete = useCallback(async () => {
    if (!selectedRouter || !confirmDelete.user) return;
    const username = confirmDelete.user.username;
    const key = `delete-${username}`;
    
    setActionLoading(prev => ({ ...prev, [key]: true }));
    
    try {
      await api.delete(`/pppoe/${selectedRouter}/user/${username}`);
      triggerRowAnimation(username);
      
      await loadUsers(selectedRouter);
      
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to delete user");
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
      setConfirmDelete({ show: false, user: null });
    }
  }, [selectedRouter, confirmDelete.user, loadUsers, triggerRowAnimation]);

  /* ───────────────── TOGGLE DISABLE/ENABLE HANDLER ───────────────── */
  const handleToggleDisable = useCallback(async (user) => {
    if (!selectedRouter) return;
    const username = user.username;
    const key = `toggle-${username}`;
    const nextDisabled = !user.disabled;
    
    setActionLoading(prev => ({ ...prev, [key]: true }));
    
    try {
      const changedAt = new Date().toISOString();
      setPppoeUsers((prev) => prev.map((item) => {
        if (String(item.username) !== String(username)) return item;
        return {
          ...item,
          disabled: nextDisabled,
          isOnline: nextDisabled ? false : item.isOnline,
          ip: nextDisabled ? null : item.ip,
          remoteAddress: nextDisabled ? null : item.remoteAddress,
          localAddress: nextDisabled ? null : item.localAddress,
          uptime: nextDisabled ? null : item.uptime,
          downtime: nextDisabled ? "0s" : null,
          lastSeen: nextDisabled ? changedAt : item.lastSeen,
          lastDisconnect: nextDisabled ? changedAt : item.lastDisconnect,
          realtimeUpdatedAt: Date.now(),
          rx: nextDisabled ? 0 : item.rx,
          tx: nextDisabled ? 0 : item.tx,
        };
      }));

      const res = await api.put(`/pppoe/${selectedRouter}/user/${username}`, { disabled: nextDisabled });
      
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to update secret status");
      }
      
      triggerRowAnimation(username);
      await loadUsers(selectedRouter);
      
      // Add a slight delay to allow the MikroTik to physically disconnect the session
      // and the realtime background sync to catch up, preventing icon blinking.
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (err) {
      console.error(err);
      await loadUsers(selectedRouter);
      alert(err.response?.data?.message || err.message || "Failed to toggle status");
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  }, [selectedRouter, loadUsers, triggerRowAnimation, setPppoeUsers]);

  /* ───────────────── RECONNECT SESSION HANDLER ───────────────── */
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
      
      // Delay for session cleanup
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || err.message || "Failed to reconnect user session");
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  }, [selectedRouter, loadUsers, triggerRowAnimation]);

  /* ───────────────── PAGINATED USERS ───────────────── */
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  }, [filteredUsers.length, itemsPerPage]);

  /* ───────────────── METRICS ───────────────── */
  const latest = metrics?.latest || {};
  const cpu = safeNumber(latest.cpu);
  const ram = safeNumber(latest.ram);
  const rx = safeNumber(latest.rx ?? latest.rxBps ?? latest.rxRaw);
  const tx = safeNumber(latest.tx ?? latest.txBps ?? latest.txRaw);

  /* ───────────────── SUMMARY ───────────────── */
  const offlineCount = filteredUsers.length - onlineUsers;
  const locatedCount = filteredUsers.filter((u) => u.latitude && u.longitude).length;

  /* ───────────────── MAIN RENDER ───────────────── */
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
        
        .table-container { max-height: calc(100vh - 400px); overflow-y: auto; }
        .table-container::-webkit-scrollbar { width: 6px; }
        .table-container::-webkit-scrollbar-track { background: #f1f1f1; }
        .table-container::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
        .table-container::-webkit-scrollbar-thumb:hover { background: #a1a1a1; }
      `}</style>

      <div className="container-fluid py-3" style={{ background: "#f8f9fa", minHeight: "100vh" }}>
        
        {/* HEADER */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
          <div>
            <h3 className="fw-bold mb-1">
              <i className="bi bi-router me-2"></i>PPPoE Sessions
            </h3>
            <p className="text-muted mb-0 small">Monitor & manage user connections</p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <ConnectionBadge connected={socketConnected && isRouterConnected} />
            <button
              className="btn btn-primary btn-sm d-flex align-items-center gap-2 btn-hover-scale"
              onClick={() => setShowAddModal(true)}
            >
              <i className="bi bi-plus-lg"></i>
              <span className="d-none d-sm-inline">Add User</span>
            </button>
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
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="row g-2 align-items-end">
              <div className="col-md-3">
                <label className="form-label small text-muted fw-semibold mb-1">Router</label>
                <div className="input-group input-group-sm">
                  <select
                    className="form-select"
                    value={selectedRouter || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedRouter(val ? Number(val) : null);
                      if (isRouterLocked && val) {
                          localStorage.setItem('locked_router_id', val);
                      }
                    }}
                  >
                    {routers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.host ? `(${r.host})` : ""}
                      </option>
                    ))}
                  </select>
                  <button 
                      className={`btn btn-outline-secondary ${isRouterLocked ? 'text-primary' : 'text-muted'}`}
                      type="button"
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
                  >
                      <i className={`bi ${isRouterLocked ? 'bi-lock-fill' : 'bi-unlock'}`}></i>
                  </button>
                </div>
              </div>
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
              <div className="col-md-2">
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
              <div className="col-md-2">
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
              <div className="col-md-2">
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
                <div className="card border-0 shadow-sm h-100">
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
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-semibold">
              <i className="bi bi-people me-2"></i>User Sessions
              <span className="badge bg-secondary ms-2">{filteredUsers.length}</span>
            </h5>
            <div className="small text-muted">
              <span className="text-success">{onlineUsers} online</span> •{" "}
              <span className="text-danger">{offlineCount} offline</span> •{" "}
              <span className="text-primary">{locatedCount} located</span>
            </div>
          </div>
          
          {/* Pagination Top */}
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredUsers.length}
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
                  <th className="text-end" style={{ width: "100px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading && !filteredUsers.length ? (
                  <tr>
                    <td colSpan="9" className="text-center py-5">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : !paginatedUsers.length && filteredUsers.length > 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-5 text-muted">
                      <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                      <p className="mb-0">Halaman kosong. Coba ubah nomor halaman atau filter.</p>
                    </td>
                  </tr>
                ) : !filteredUsers.length ? (
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
                          <div className="fw-medium">{u.username || "-"}</div>
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
                                {getLiveSessionDuration(u, liveNow)}
                              </span>
                              <span className="text-muted d-block mt-1" style={{ fontSize: "0.75rem" }}>Uptime</span>
                            </div>
                          ) : (
                            <div>
                              <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 small fw-semibold">
                                <i className="bi bi-clock me-1" />
                                {getLiveSessionDuration(u, liveNow)}
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
                            <button
                              className="btn btn-sm btn-link p-0 text-muted small"
                              onClick={() => openLocationModal(u)}
                              title="Add location"
                            >
                              <i className="bi bi-plus-circle me-1"></i>Add
                            </button>
                          )}
                        </td>
                        
                        {/* ✅ ACTIONS: Edit, Toggle Enable/Disable, Kick (online only), Location, Delete */}
                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-1">
                            <ActionButton
                              icon="pencil"
                              title="Edit Secret"
                              variant="primary"
                              onClick={() => openEditModal(u)}
                              loading={actionLoading[`edit-${u.username}`]}
                            />
                            <ActionButton
                              icon={u.disabled ? "play-fill" : "pause-fill"}
                              title={u.disabled ? "Enable Secret" : "Disable Secret"}
                              variant={u.disabled ? "success" : "warning"}
                              onClick={() => handleToggleDisable(u)}
                              loading={actionLoading[`toggle-${u.username}`]}
                            />
                            <ActionButton
                              icon="arrow-clockwise"
                              title="Reconnect Session"
                              variant="info"
                              disabled={!u.isOnline}
                              onClick={() => handleReconnectUser(u)}
                              loading={actionLoading[`reconnect-${u.username}`]}
                            />
                            <ActionButton
                              icon="geo-alt"
                              title="Edit Location"
                              variant="link"
                              onClick={() => openLocationModal(u)}
                              loading={actionLoading[`location-${u.username}`]}
                            />
                            <ActionButton
                              icon="trash"
                              title="Delete User"
                              variant="danger"
                              onClick={() => setConfirmDelete({ show: true, user: u })}
                              loading={actionLoading[`delete-${u.username}`]}
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
            totalItems={filteredUsers.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          />
        </div>

  
        {/* DELETE CONFIRMATION */}
        <ConfirmDialog
          show={confirmDelete.show}
          title="Confirm Delete"
          message={`Are you sure you want to delete user "${confirmDelete.user?.username}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete({ show: false, user: null })}
        />

        {/* ADD MODAL */}
        <AddSecret
          show={showAddModal}
          onClose={() => setShowAddModal(false)}
          routerId={selectedRouter}
          onSaved={async () => {
            await loadUsers(selectedRouter);
          }}
        />

        {/* EDIT MODAL */}
        {editingUser && (
          <EditSecret
            show={showEditModal}
            username={editingUser.username}
            initialUser={editingUser}
            routerId={selectedRouter}
            onClose={() => {
              setShowEditModal(false);
              setEditingUser(null);
            }}
            onSaved={async () => {
              await loadUsers(selectedRouter);
            }}
          />
        )}

        {/* LOCATION MODAL */}
        <LocationModal
          show={!!locationUser}
          user={locationUser}
          routerId={selectedRouter}
          onClose={() => setLocationUser(null)}
          onSaved={async () => {
            await loadUsers(selectedRouter);
          }}
        />
      </div>
    </>
  );
}
