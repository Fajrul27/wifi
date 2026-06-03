// src/components/PPPoEProfiles.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import api from "../../services/api";

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
const formatRateLimit = (val) => {
  if (!val) return <span className="text-muted small">-</span>;
  return <span className="fw-medium text-success">{val.replace(/M/g, " Mbps").trim()}</span>;
};

const formatDateTime = (date) => {
  return new Date(date).toLocaleString("id-ID", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
  });
};

// ─────────────────────────────────────────────────────────────
// REUSABLE COMPONENTS
// ─────────────────────────────────────────────────────────────
const StatusPill = ({ active, label }) => (
  <span className={`badge rounded-pill px-3 py-1 border ${
    active 
      ? "bg-success-subtle text-success-emphasis border-success-subtle" 
      : "bg-secondary-subtle text-secondary-emphasis border-secondary-subtle"
  }`}>
    <i className={`bi ${active ? "bi-check-circle-fill" : "bi-circle"} me-1 ${active ? "text-success" : "text-muted"}`} style={{ fontSize: "0.65rem" }}></i>
    {label}
  </span>
);



// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function PPPoEProfiles() {
  /* ───────── STATE ───────── */
  const [isRouterLocked, setIsRouterLocked] = useState(() => localStorage.getItem('lock_router') === 'true');
  const [routers, setRouters] = useState([]);
  const [selectedRouter, setSelectedRouter] = useState(() => {
     if (localStorage.getItem('lock_router') === 'true') {
         const saved = localStorage.getItem('locked_router_id');
         if (saved) return Number(saved);
     }
     return null;
  });
  const [profiles, setProfiles] = useState([]);
  
  /* ───────── UI STATE ───────── */
  const [loadingRouters, setLoadingRouters] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  /* ───────── LOAD ROUTERS ───────── */
  const loadRouters = useCallback(async () => {
    try {
      setLoadingRouters(true);
      const res = await api.get("/routers");
      // Support both response formats: {data: [...]} or [...]
      const routerList = res.data?.data || res.data || [];
      setRouters(routerList);
      if (routerList.length > 0) {
        setSelectedRouter(prev => prev || routerList[0].id);
      }
    } catch (err) {
      console.error("Failed to load routers:", err);
      setError("Gagal memuat daftar router");
    } finally {
      setLoadingRouters(false);
    }
  }, []);

  /* ───────── LOAD PROFILES ───────── */
  const fetchProfiles = useCallback(async (routerId) => {
    if (!routerId) return;
    try {
      setLoadingProfiles(true);
      setError(null);
      const response = await api.get(`/pppoe/${routerId}/profiles`);
      if (response.data?.success) {
        setProfiles(response.data.data || []);
      } else {
        setError("Gagal memuat data profiles");
      }
    } catch (err) {
      console.error("Error fetching PPPoE profiles:", err);
      setError(err.response?.data?.message || "Terjadi kesalahan saat mengambil data");
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  /* ───────── INIT ───────── */
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await loadRouters();
      if (!mounted) return;
    };
    init();
    return () => { mounted = false; };
  }, [loadRouters]);

  /* ───────── FETCH ON ROUTER CHANGE ───────── */
  useEffect(() => {
    if (selectedRouter) {
      fetchProfiles(selectedRouter);
    }
  }, [selectedRouter, fetchProfiles]);

  /* ───────── SYNC HANDLER ───────── */
  const handleSync = async () => {
    if (!selectedRouter) return;
    try {
      setSyncing(true);
      setSyncResult(null);
      const response = await api.post(`/pppoe/${selectedRouter}/sync`);
      
      if (response.data?.success) {
        setSyncResult({ type: "success", message: response.data.message, data: response.data });
        await fetchProfiles(selectedRouter);
      } else {
        setSyncResult({ type: "error", message: response.data?.message || "Sync gagal" });
      }
    } catch (err) {
      console.error("Sync error:", err);
      setSyncResult({ type: "error", message: err.response?.data?.message || "Terjadi kesalahan saat sync" });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 4000);
    }
  };

  /* ───────── FILTERED PROFILES ───────── */
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) =>
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.rateLimit?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [profiles, searchTerm]);

  /* ───────── STATS ───────── */
  const stats = useMemo(() => ({
    total: profiles.length,
    withLimit: profiles.filter((p) => p.rateLimit).length,
    single: profiles.filter((p) => p.onlyOne).length,
  }), [profiles]);

  /* ───────── ACTIVE ROUTER INFO ───────── */
  const activeRouter = useMemo(() => 
    routers.find((r) => r.id === selectedRouter), 
  [routers, selectedRouter]);

  /* ───────── RENDER ───────── */
  return (
    <div className="container-fluid py-3" style={{ background: "#f8f9fa", minHeight: "100vh" }}>
      
      {/* ═════ HEADER ═════ */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h3 className="fw-bold mb-1 text-dark">
            <i className="bi bi-wifi me-2 text-primary"></i>PPPoE Profiles
          </h3>
          <p className="text-muted mb-0 small">
            {activeRouter ? (
              <>Managing profiles for <strong>{activeRouter.name}</strong> <span className="text-muted">({activeRouter.host})</span></>
            ) : (
              "Select a router to manage profiles"
            )}
          </p>
        </div>
        
        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-warning btn-sm d-flex align-items-center gap-2 px-3"
            onClick={handleSync}
            disabled={syncing || !selectedRouter}
            title="Sync profiles from router"
          >
            {syncing ? (
              <><span className="spinner-border spinner-border-sm" role="status"></span> Syncing...</>
            ) : (
              <><i className="bi bi-arrow-clockwise"></i> Sync Now</>
            )}
          </button>
        </div>
      </div>

      {/* ═════ CONTROL BAR ═════ */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: "12px" }}>
        <div className="card-body py-3">
          <div className="row g-3 align-items-end">
            
            {/* Router Selector */}
            <div className="col-md-4">
              <label className="form-label small text-muted fw-semibold mb-1">
                <i className="bi bi-router me-1"></i>Select Router
              </label>
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
                  disabled={loadingRouters || routers.length === 0}
                >
                  <option value="">-- Choose Router --</option>
                  {routers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.host && <span className="text-muted">({r.host})</span>}
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

            {/* Search */}
            <div className="col-md-4">
              <label className="form-label small text-muted fw-semibold mb-1">
                <i className="bi bi-search me-1"></i>Search Profile
              </label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Name or rate limit..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={!selectedRouter}
              />
            </div>

            {/* Quick Stats */}
            <div className="col-md-4">
              <label className="form-label small text-muted fw-semibold mb-1">&nbsp;</label>
              <div className="d-flex gap-2">
                <div className="flex-grow-1 card border-0 bg-light px-3 py-2 text-center">
                  <div className="small text-muted text-uppercase fw-semibold">Total</div>
                  <div className="fs-5 fw-bold text-dark">{stats.total}</div>
                </div>
                <div className="flex-grow-1 card border-0 bg-light px-3 py-2 text-center">
                  <div className="small text-muted text-uppercase fw-semibold">Limited</div>
                  <div className="fs-5 fw-bold text-success">{stats.withLimit}</div>
                </div>
                <div className="flex-grow-1 card border-0 bg-light px-3 py-2 text-center">
                  <div className="small text-muted text-uppercase fw-semibold">Single</div>
                  <div className="fs-5 fw-bold text-warning">{stats.single}</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ═════ SYNC RESULT ALERT ═════ */}
      {syncResult && (
        <div
          className={`alert alert-${syncResult.type === "success" ? "success" : "danger"} alert-dismissible fade show mb-4 border-0 shadow-sm`}
          role="alert"
          style={{ animation: "slideIn 0.25s ease-out", borderRadius: "12px" }}
        >
          <div className="d-flex align-items-start gap-3">
            <div className={`rounded-circle p-2 ${syncResult.type === "success" ? "bg-success-subtle" : "bg-danger-subtle"}`}>
              <i className={`bi bi-${syncResult.type === "success" ? "check-circle" : "exclamation-circle"}-fill fs-5 ${syncResult.type === "success" ? "text-success" : "text-danger"}`}></i>
            </div>
            <div className="flex-grow-1">
              <h6 className="mb-1 fw-semibold">{syncResult.type === "success" ? "✓ Sync Completed" : "✗ Sync Failed"}</h6>
              <p className="mb-2 small text-muted">{syncResult.message}</p>
              {syncResult.data && (
                <div className="d-flex flex-wrap gap-2">
                  <span className="badge bg-white text-dark border shadow-sm">📦 Total: {syncResult.data.total}</span>
                  <span className="badge bg-white text-success border shadow-sm">✨ +{syncResult.data.created} New</span>
                  <span className="badge bg-white text-primary border shadow-sm">↻ {syncResult.data.updated} Updated</span>
                  {syncResult.data.deleted > 0 && (
                    <span className="badge bg-white text-danger border shadow-sm">🗑️ -{syncResult.data.deleted} Deleted</span>
                  )}
                  {syncResult.data.realtime && (
                    <span className="badge bg-white text-info border shadow-sm">⚡ Realtime</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button type="button" className="btn-close" onClick={() => setSyncResult(null)}></button>
        </div>
      )}

      {/* ═════ ERROR ALERT ═════ */}
      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-4 border-0 shadow-sm" role="alert" style={{ borderRadius: "12px" }}>
          <div className="d-flex align-items-center gap-3">
            <i className="bi bi-exclamation-triangle-fill fs-5"></i>
            <span>{error}</span>
          </div>
          <button type="button" className="btn-close" onClick={() => setError(null)}></button>
        </div>
      )}

      {/* ═════ PROFILES TABLE ═════ */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: "12px", overflow: "hidden" }}>
        
        {/* Table Header */}
        <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center border-0">
          <h5 className="mb-0 fw-semibold text-dark">
            <i className="bi bi-list-ul me-2 text-primary"></i>Profile List
            <span className="badge bg-secondary ms-2 rounded-pill">{filteredProfiles.length}</span>
          </h5>
          {activeRouter && (
            <small className="text-muted">
              <code>{activeRouter.host}:{activeRouter.port}</code>
            </small>
          )}
        </div>

        {/* Table Body */}
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="bg-light">
              <tr>
                <th className="small text-muted text-uppercase fw-semibold py-3 px-4" style={{ width: "50px" }}>#</th>
                <th className="small text-muted text-uppercase fw-semibold py-3 px-4">Profile Name</th>
                <th className="small text-muted text-uppercase fw-semibold py-3 px-4">Rate Limit</th>
                <th className="small text-muted text-uppercase fw-semibold py-3 px-4 text-center">Session Mode</th>
                <th className="small text-muted text-uppercase fw-semibold py-3 px-4 text-end">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {loadingRouters || loadingProfiles ? (
                <tr>
                  <td colSpan="5" className="text-center py-5">
                    <div className="d-flex flex-column align-items-center gap-3">
                      <div className="spinner-border text-primary" role="status" style={{ width: "2rem", height: "2rem" }}></div>
                      <small className="text-muted">Loading profiles...</small>
                    </div>
                  </td>
                </tr>
              ) : filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-5">
                    <div className="d-flex flex-column align-items-center gap-3">
                      <div className="bg-light rounded-circle p-4">
                        <i className="bi bi-inbox fs-1 text-muted"></i>
                      </div>
                      <div>
                        <p className="mb-1 fw-medium text-dark">
                          {searchTerm ? "No results found" : selectedRouter ? "No profiles yet" : "Select a router to begin"}
                        </p>
                        <small className="text-muted">
                          {searchTerm 
                            ? "Try adjusting your search terms" 
                            : selectedRouter 
                              ? "Click Sync to fetch profiles from router" 
                              : "Choose a router from the dropdown above"}
                        </small>
                      </div>
                      {!searchTerm && selectedRouter && (
                        <button className="btn btn-warning btn-sm mt-2" onClick={handleSync} disabled={syncing}>
                          <i className="bi bi-arrow-clockwise me-1"></i>Sync Now
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p, i) => (
                  <tr key={p.id} className="border-bottom" style={{ borderColor: "#f1f3f5" }}>
                    <td className="py-3 px-4">
                      <span className="badge bg-light text-dark border-0 rounded-pill" style={{ minWidth: "32px" }}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="d-flex flex-column">
                        <span className="fw-medium text-dark">{p.name}</span>
                        <small className="text-muted" style={{ fontSize: "0.75rem" }}>
                          ID: {p.id} • Router: #{p.routerId}
                        </small>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {p.rateLimit ? (
                        <span className="badge bg-success-subtle text-success-emphasis border border-success-subtle rounded-pill px-3">
                          {formatRateLimit(p.rateLimit)}
                        </span>
                      ) : (
                        <span className="badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle rounded-pill px-3">
                          No limit
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusPill active={p.onlyOne} label={p.onlyOne ? "Single" : "Multi"} />
                    </td>
                    <td className="py-3 px-4 text-end">
                      <small className="text-muted">{formatDateTime(p.updatedAt)}</small>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="card-footer bg-white py-2 px-4 d-flex justify-content-between align-items-center border-0">
          <small className="text-muted">
            Showing <strong>{filteredProfiles.length}</strong> of <strong>{profiles.length}</strong> profiles
          </small>
          {syncResult?.data?.realtime && (
            <span className="badge bg-success-subtle text-success-emphasis border border-success-subtle rounded-pill px-3 py-1">
              <i className="bi bi-lightning-fill me-1"></i>Realtime Sync
            </span>
          )}
        </div>
      </div>

    </div>
  );
}