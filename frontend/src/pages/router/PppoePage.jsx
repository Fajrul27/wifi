import { useEffect, useMemo, useState } from "react";
import { useRouterMonitor } from "./RouterMonitor";
import api from "../../services/api";
import MapPicker from "../../components/MapPicker";
import {
  usePppoeUserMonitor,
  ConnectionBadge,
} from "./PppoeUserMonitor";

// ─────────────────────────────────────────────────────────────
// CONFIG & UTILS
// ─────────────────────────────────────────────────────────────
const safeNumber = (v) => (isNaN(Number(v)) ? 0 : Number(v));

const formatPercent = (v) => `${safeNumber(v).toFixed(1)}%`;

const formatTraffic = (v) => {
  const n = safeNumber(v);
  if (!n) return "0 bps";
  const units = ["bps", "Kbps", "Mbps", "Gbps", "Tbps"];
  let i = 0;
  let value = n;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(2)} ${units[i]}`;
};

// ─────────────────────────────────────────────────────────────
// REUSABLE COMPONENTS
// ─────────────────────────────────────────────────────────────
const StatusBadge = ({ online, small = false }) => (
  <span
    className={`badge rounded-pill ${small ? "px-2 py-1" : "px-3 py-2"} ${
      online
        ? "bg-success-subtle text-success-emphasis border border-success-subtle"
        : "bg-danger-subtle text-danger-emphasis border border-danger-subtle"
    }`}
  >
    <i
      className={`bi bi-circle-fill me-1 ${online ? "text-success" : "text-danger"}`}
      style={{ fontSize: small ? "0.5rem" : "0.6rem" }}
    ></i>
    <span className={small ? "small" : ""}>{online ? "Online" : "Offline"}</span>
  </span>
);

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function PppoeDashboard() {
  /* ───────────────── STATE ───────────────── */
  const [selectedRouter, setSelectedRouter] = useState(null);
  const [routers, setRouters] = useState([]);

  /* ───────────────── FILTERS & UI ───────────────── */
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [syncing, setSyncing] = useState(false);

  /* ───────────────── LOCATION MODAL ───────────────── */
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);

  /* ───────────────── ROUTER MONITOR ───────────────── */
  const {
    loadRouters,
    metrics,
    socketConnected,
  } = useRouterMonitor(selectedRouter);

  /* ───────────────── USER MONITOR ───────────────── */
  const {
    loadUsers,
    filteredUsers,
  } = usePppoeUserMonitor(selectedRouter);

  /* ───────────────── INIT ───────────────── */
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const data = await loadRouters();
      if (!mounted) return;
      setRouters(data || []);
      if (data?.length > 0) {
        setSelectedRouter(data[0].id);
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  /* ───────────────── CRUD MODAL ───────────────── */
  const [crudModal, setCrudModal] = useState(false);
  const [crudMode, setCrudMode] = useState("add"); // 'add' | 'edit'
  const [crudUser, setCrudUser] = useState(null);
  const [crudForm, setCrudForm] = useState({
    username: "", password: "", profile: "", keterangan: "",
    remoteAddress: "", localAddress: "",
    latitude: "", longitude: "",
    customProfileName: "", customRateLimit: ""
  });
  const [crudLoading, setCrudLoading] = useState(false);
  const [crudError, setCrudError]   = useState("");
  const [crudTab, setCrudTab]       = useState("info"); // 'info' | 'lokasi' | 'keamanan'
  const [mikrotikProfiles, setMikrotikProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading]   = useState(false);
  const [dbProfiles, setDbProfiles]             = useState([]);

  // Load profile dari DB SpeedProfile
  useEffect(() => {
    api.get("/speed-profiles").then(r => setDbProfiles(r.data?.data || [])).catch(() => {});
  }, []);

  const loadProfiles = async () => {
    if (!selectedRouter) return;
    setProfilesLoading(true);
    try {
      const res = await api.get(`/pppoe/${selectedRouter}/profiles`);
      setMikrotikProfiles(res.data?.data || []);
    } catch { setMikrotikProfiles([]); }
    finally { setProfilesLoading(false); }
  };

  const openAddModal = async () => {
    setCrudMode("add");
    setCrudUser(null);
    setCrudForm({
      username: "",
      password: "12345678",
      profile: "5 Mbps",
      keterangan: "",
      remoteAddress: "",
      localAddress: "",
      latitude: "",
      longitude: "",
      customProfileName: "5 Mbps",
      customRateLimit: "5M/5M"
    });
    setCrudError("");
    setCrudTab("info");
    setCrudModal(true);
    loadProfiles();
  };

  const openEditModal = async (user) => {
    setCrudMode("edit");
    setCrudUser(user);
    setCrudForm({
      username: user.username,
      password: "",
      profile: user.profile || "",
      keterangan: user.keterangan || "",
      remoteAddress: user.remoteAddress || "",
      localAddress: user.localAddress || "",
      latitude: user.latitude ?? "",
      longitude: user.longitude ?? "",
      customProfileName: "",
      customRateLimit: ""
    });
    setCrudError("");
    setCrudTab("info");
    setCrudModal(true);
    loadProfiles();
  };

  const handleCrudSubmit = async () => {
    if (!selectedRouter) return;
    setCrudLoading(true);
    setCrudError("");
    try {
      const payload = { ...crudForm };
      if (payload.profile === "__custom__") {
        if (!payload.customProfileName.trim() || !payload.customRateLimit.trim()) {
          setCrudError("Nama Profil dan Limit Kecepatan manual wajib diisi");
          setCrudLoading(false);
          return;
        }
        payload.profile = payload.customProfileName.trim();
        payload.rateLimit = payload.customRateLimit.trim();
      } else if (payload.profile === "5 Mbps") {
        payload.rateLimit = "5M/5M";
      }

      if (crudMode === "add") {
        await api.post(`/pppoe/${selectedRouter}/user`, payload);
      } else {
        // Gunakan endpoint /full untuk update profile + password + lokasi sekaligus
        await api.put(`/pppoe/${selectedRouter}/user/${crudUser.id}/full`, payload);
      }
      setCrudModal(false);
      loadUsers(selectedRouter);
    } catch (err) {
      setCrudError(err.response?.data?.message || err.message);
    } finally {
      setCrudLoading(false);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Hapus user "${user.username}" dari Mikrotik dan database?`)) return;
    try {
      await api.delete(`/pppoe/${selectedRouter}/user/${user.id}`);
      loadUsers(selectedRouter);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal menghapus user");
    }
  };

  const handleKick = async (user) => {
    if (!window.confirm(`Putuskan sesi aktif "${user.username}"?`)) return;
    try {
      await api.post(`/pppoe/${selectedRouter}/user/${user.id}/kick`);
      alert(`Sesi ${user.username} berhasil diputus`);
    } catch (err) {
      alert(err.response?.data?.message || "Gagal memutus sesi");
    }
  };


  /* ───────────────── LOAD USERS ───────────────── */

  /* ───────────────── SYNC ───────────────── */
  const handleSync = async () => {
    if (!selectedRouter) return;
    try {
      setSyncing(true);
      await fetch(
        `http://localhost:3000/api/pppoe/${selectedRouter}/sync`,
        { method: "POST" }
      );
      await loadUsers(selectedRouter);
    } catch (err) {
      console.error(err);
      alert("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  /* ───────────────── LOCATION MODAL HANDLERS ───────────────── */
  const openLocationModal = (user) => {
    setSelectedUser(user);
    setLatitude(user.latitude ?? "");
    setLongitude(user.longitude ?? "");
    setShowLocationModal(true);
  };

  const closeLocationModal = () => {
    setShowLocationModal(false);
    setSelectedUser(null);
    setLatitude("");
    setLongitude("");
  };

  const saveLocation = async () => {
    if (!selectedRouter || !selectedUser) return;
    try {
      setSavingLocation(true);
      const res = await fetch(
        `http://localhost:3000/api/pppoe/${selectedRouter}/user/${selectedUser.id}/location`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: latitude === "" ? null : Number(latitude),
            longitude: longitude === "" ? null : Number(longitude),
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Gagal update lokasi");
      }
      await loadUsers(selectedRouter);
      closeLocationModal();
    } catch (err) {
      console.error(err);
      alert(err.message || "Gagal update lokasi");
    } finally {
      setSavingLocation(false);
    }
  };

  /* ───────────────── FILTERED USERS ───────────────── */
  const users = useMemo(() => {
    return [...(filteredUsers || [])]
      .filter((u) => {
        // SEARCH
        if (search && !String(u.username || "").toLowerCase().includes(search.toLowerCase())) {
          return false;
        }
        // STATUS
        if (statusFilter === "online" && !u.isOnline) return false;
        if (statusFilter === "offline" && u.isOnline) return false;
        // LOCATION
        const hasLocation = u.latitude !== null && u.longitude !== null;
        if (locationFilter === "located" && !hasLocation) return false;
        if (locationFilter === "unlocated" && hasLocation) return false;
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "uptime":
            return String(b.uptime || "").localeCompare(String(a.uptime || ""));
          case "name":
          default:
            return String(a.username || "").localeCompare(String(b.username || ""));
        }
      });
  }, [filteredUsers, search, statusFilter, locationFilter, sortBy]);

  /* ───────────────── METRICS ───────────────── */
  const latest = metrics?.latest || {};
  const cpu = safeNumber(latest.cpu);
  const ram = safeNumber(latest.ram);
  const rx = safeNumber(latest.rx ?? latest.rxBps ?? latest.rxRaw);
  const tx = safeNumber(latest.tx ?? latest.txBps ?? latest.txRaw);

  /* ───────────────── SUMMARY ───────────────── */
  const onlineCount = users.filter((u) => u.isOnline).length;
  const offlineCount = users.length - onlineCount;
  const locatedCount = users.filter((u) => u.latitude !== null && u.longitude !== null).length;

  /* ───────────────── MAIN RENDER ───────────────── */
  return (
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
          <ConnectionBadge connected={socketConnected} />
          <button
            className="btn btn-warning btn-sm d-flex align-items-center gap-2"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <span className="spinner-border spinner-border-sm" role="status"></span>
            ) : (
              <i className="bi bi-arrow-clockwise"></i>
            )}
            Sync
          </button>
        </div>
      </div>

      {/* CONTROL BAR */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            {/* Router Selector */}
            <div className="col-md-3">
              <label className="form-label small text-muted fw-semibold mb-1">Router</label>
              <select
                className="form-select form-select-sm"
                value={selectedRouter || ""}
                onChange={(e) => setSelectedRouter(Number(e.target.value))}
              >
                {routers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.host ? `(${r.host})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="col-md-3">
              <label className="form-label small text-muted fw-semibold mb-1">Search</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <div className="col-md-2">
              <label className="form-label small text-muted fw-semibold mb-1">Status</label>
              <select
                className="form-select form-select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            {/* Location Filter */}
            <div className="col-md-2">
              <label className="form-label small text-muted fw-semibold mb-1">Location</label>
              <select
                className="form-select form-select-sm"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="located">📍 Has Location</option>
                <option value="unlocated">❌ No Location</option>
              </select>
            </div>

            {/* Sort */}
            <div className="col-md-2">
              <label className="form-label small text-muted fw-semibold mb-1">Sort By</label>
              <select
                className="form-select form-select-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="name">Name</option>
                <option value="uptime">Uptime</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ROUTER METRICS */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body py-3">
              <div className="small text-muted text-uppercase fw-semibold mb-1">CPU Load</div>
              <div className="fs-4 fw-bold text-danger">{formatPercent(cpu)}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body py-3">
              <div className="small text-muted text-uppercase fw-semibold mb-1">RAM Usage</div>
              <div className="fs-4 fw-bold text-warning">{formatPercent(ram)}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body py-3">
              <div className="small text-muted text-uppercase fw-semibold mb-1">RX Traffic</div>
              <div className="fs-4 fw-bold text-success">{formatTraffic(rx)}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body py-3">
              <div className="small text-muted text-uppercase fw-semibold mb-1">TX Traffic</div>
              <div className="fs-4 fw-bold text-primary">{formatTraffic(tx)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-semibold">
            <i className="bi bi-people me-2"></i>User Sessions
            <span className="badge bg-secondary ms-2">{users.length}</span>
          </h5>
          <button
            className="btn btn-sm btn-primary d-flex align-items-center gap-2"
            onClick={openAddModal}
          >
            <i className="bi bi-plus-lg"></i> Add User
          </button>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: "40px" }}>#</th>
                <th>User</th>
                <th>Profile</th>
                <th>Status</th>
                <th>IP Address</th>
                <th>Uptime</th>
                <th className="text-end">RX</th>
                <th className="text-end">TX</th>
                <th>Location</th>
                <th className="text-end" style={{ width: "130px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!users.length ? (
                <tr>
                  <td colSpan="10" className="text-center py-5 text-muted">
                    <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                    <p className="mb-0">No data found matching your filters</p>
                  </td>
                </tr>
              ) : (
                users.map((u, i) => (
                  <tr key={String(u.id)} className={u.isOnline ? "" : "opacity-75"}>
                    <td>{i + 1}</td>
                    <td>
                      <div className="fw-medium">{u.username || "-"}</div>
                      {u.keterangan && <small className="text-muted d-block">{u.keterangan}</small>}
                    </td>
                    <td>
                      <span className="badge bg-dark bg-opacity-10 text-dark border border-secondary-subtle rounded-pill px-3 py-1 fw-bold d-inline-flex align-items-center gap-1 shadow-sm small">
                        <i className="bi bi-hdd-network text-primary"></i> {u.profile || "default"}
                      </span>
                    </td>
                    <td>
                      <StatusBadge online={u.isOnline} small />
                    </td>
                    <td>
                      <code className="small">{u.ip || u.remoteAddress || "-"}</code>
                    </td>
                    <td>{u.isOnline ? u.uptime : u.downtime || "-"}</td>
                    <td className="text-end">
                      <span className="text-success fw-medium">{formatTraffic(u.rx ?? u.rxRaw)}</span>
                    </td>
                    <td className="text-end">
                      <span className="text-primary fw-medium">{formatTraffic(u.tx ?? u.txRaw)}</span>
                    </td>
                    <td>
                      {u.latitude && u.longitude ? (
                        <a
                          href={`https://maps.google.com/?q=${u.latitude},${u.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-decoration-none small"
                        >
                          <i className="bi bi-geo-alt-fill text-danger me-1"></i>
                          {parseFloat(u.latitude).toFixed(3)}, {parseFloat(u.longitude).toFixed(3)}
                        </a>
                      ) : (
                        <button
                          className="btn btn-sm btn-link p-0 text-muted small"
                          onClick={() => openLocationModal(u)}
                        >
                          <i className="bi bi-plus-circle me-1"></i>Add
                        </button>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => openLocationModal(u)}
                          title="Edit koordinat"
                        >
                          <i className="bi bi-geo-alt"></i>
                        </button>
                        <button
                          className="btn btn-outline-primary"
                          onClick={() => openEditModal(u)}
                          title="Edit user"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        {u.isOnline && (
                          <button
                            className="btn btn-outline-warning"
                            onClick={() => handleKick(u)}
                            title="Kick / putus sesi"
                          >
                            <i className="bi bi-plug"></i>
                          </button>
                        )}
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => handleDelete(u)}
                          title="Hapus user"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LOCATION EDIT MODAL — Peta Interaktif */}
      {showLocationModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 1050 }}
          onClick={closeLocationModal}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white" style={{ maxHeight: "90vh" }}>
              <div className="modal-header bg-light py-3 px-4 border-bottom border-secondary-subtle d-flex align-items-center justify-content-between">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2 fs-5">
                  <div className="bg-danger bg-opacity-10 text-danger p-2 rounded-3 d-flex align-items-center justify-content-center">
                    <i className="bi bi-geo-alt-fill"></i>
                  </div>
                  <span>Lokasi Pelanggan: <strong className="text-primary">{selectedUser?.username}</strong></span>
                </h5>
                <button type="button" className="btn-close bg-secondary bg-opacity-10 p-2 rounded-circle shadow-none" onClick={closeLocationModal}></button>
              </div>
              <div className="modal-body p-4 overflow-y-auto">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <small className="text-muted fw-medium">
                    <i className="bi bi-hand-index me-1 text-primary"></i>
                    Klik pada peta untuk menandai atau memindahkan koordinat akurat rumah pelanggan
                  </small>
                  {latitude && longitude && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger rounded-3 py-1 px-2 shadow-sm"
                      onClick={() => { setLatitude(""); setLongitude(""); }}
                    >
                      <i className="bi bi-x-circle me-1"></i>Hapus Pin
                    </button>
                  )}
                </div>
                <div className="rounded-4 overflow-hidden border border-secondary-subtle shadow-sm mb-3">
                  <MapPicker
                    key={`loc-map-${selectedUser?.id}-${showLocationModal}`}
                    lat={latitude}
                    lng={longitude}
                    height={300}
                    onChange={(lat, lng) => {
                      setLatitude(lat === "" ? "" : Number(lat).toFixed(7));
                      setLongitude(lng === "" ? "" : Number(lng).toFixed(7));
                    }}
                  />
                </div>
                {latitude && longitude && (
                  <div className="d-flex justify-content-end">
                    <a
                      href={`https://maps.google.com/?q=${latitude},${longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-success rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1 fw-medium"
                    >
                      <i className="bi bi-box-arrow-up-right"></i> Buka di Google Maps
                    </a>
                  </div>
                )}
              </div>
              <div className="modal-footer py-3 px-4 bg-light border-top border-secondary-subtle">
                <button type="button" className="btn btn-secondary rounded-3 px-4 py-2 fw-medium shadow-sm" onClick={closeLocationModal}>Batal</button>
                <button
                  type="button"
                  className="btn btn-primary rounded-3 px-4 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2"
                  onClick={saveLocation}
                  disabled={savingLocation}
                >
                  {savingLocation ? (
                    <><span className="spinner-border spinner-border-sm" role="status"></span> Menyimpan...</>
                  ) : (
                    <><i className="bi bi-check-lg"></i> Simpan Lokasi</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CRUD MODAL: ADD / EDIT USER — LENGKAP */}
      {crudModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 1060 }}
          onClick={() => setCrudModal(false)}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white" style={{ maxHeight: "90vh" }}>

              {/* HEADER */}
              <div className="modal-header bg-light py-3 px-4 border-bottom border-secondary-subtle d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-3">
                  <div className={`p-2 rounded-3 d-flex align-items-center justify-content-center ${crudMode === 'add' ? 'bg-primary bg-opacity-10 text-primary' : 'bg-warning bg-opacity-10 text-warning'}`}>
                    <i className={`bi fs-4 ${crudMode === 'add' ? 'bi-person-plus-fill' : 'bi-person-gear'}`}></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark mb-0 fs-5">
                      {crudMode === 'add' ? 'Tambah User PPPoE' : `Edit User: ${crudUser?.username}`}
                    </h5>
                    <small className="text-muted d-block mt-1">
                      {crudMode === 'add' ? 'Tambah akun PPPoE baru langsung ke Mikrotik' : 'Ubah profile, kecepatan, lokasi, atau deskripsi'}
                    </small>
                  </div>
                </div>
                <button type="button" className="btn-close bg-secondary bg-opacity-10 p-2 rounded-circle shadow-none" onClick={() => setCrudModal(false)}></button>
              </div>

              {/* TABS & BODY */}
              <div className="modal-body p-4 overflow-y-auto">
                {crudError && (
                  <div className="alert alert-danger border border-danger-subtle bg-danger bg-opacity-10 rounded-4 p-3 small mb-4 shadow-sm d-flex align-items-center gap-2">
                    <i className="bi bi-exclamation-triangle-fill text-danger fs-5"></i>
                    <div>{crudError}</div>
                  </div>
                )}

                {/* Tab Nav */}
                <ul className="nav nav-pills nav-fill mb-4 bg-light border border-secondary-subtle rounded-4 p-1 shadow-sm">
                  {[
                    { key: 'info',   icon: 'bi-person-badge', label: 'Info & Profile' },
                    { key: 'lokasi', icon: 'bi-geo-alt',      label: 'Lokasi GPS' },
                  ].map(t => (
                    <li className="nav-item" key={t.key}>
                      <button
                        className={`nav-link rounded-3 py-2 fw-semibold transition-all ${crudTab === t.key ? 'active bg-primary text-white shadow-sm' : 'text-secondary'}`}
                        onClick={() => setCrudTab(t.key)}
                      >
                        <i className={`bi ${t.icon} me-2`}></i>{t.label}
                      </button>
                    </li>
                  ))}
                </ul>

                {/* ─── TAB: INFO & PROFILE ─── */}
                {crudTab === 'info' && (
                  <div className="row g-4">
                    <div className="col-12">
                      <label className="form-label small fw-bold text-secondary mb-1">Username PPPoE</label>
                      <input
                        type="text"
                        className={`form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none ${crudMode === 'edit' ? 'bg-light' : ''}`}
                        placeholder="contoh: pelanggan-01"
                        value={crudForm.username}
                        disabled={crudMode === 'edit'}
                        onChange={(e) => setCrudForm(f => ({ ...f, username: e.target.value }))}
                      />
                      {crudMode === 'edit' && <div className="form-text text-muted mt-1"><i className="bi bi-info-circle me-1"></i> Username tidak dapat diubah setelah dibuat</div>}
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-bold text-secondary mb-1">Password PPPoE</label>
                      <input
                        type="text"
                        className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                        placeholder={crudMode === 'edit' ? '(kosongkan jika tidak ingin mengubah password)' : 'Masukkan password (default: 12345678)'}
                        value={crudForm.password}
                        onChange={(e) => setCrudForm(f => ({ ...f, password: e.target.value }))}
                      />
                      {crudMode === 'add' && <div className="form-text text-muted mt-1"><i className="bi bi-info-circle me-1"></i> Default password disetel ke 12345678 untuk kemudahan</div>}
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-bold text-secondary mb-1 d-flex justify-content-between align-items-center">
                        <span><i className="bi bi-speedometer2 me-1 text-primary"></i> Profile Kecepatan</span>
                        {profilesLoading && <span className="spinner-border spinner-border-sm text-primary"></span>}
                      </label>
                      {/* Gabungan DB + Mikrotik profiles */}
                      {(dbProfiles.length > 0 || mikrotikProfiles.length > 0) ? (
                        <>
                          <select
                            className="form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                            value={crudForm.profile}
                            onChange={(e) => setCrudForm(f => ({ ...f, profile: e.target.value }))}
                          >
                            <option value="">— Pilih Profile —</option>
                            {!dbProfiles.some(p => p.name === "5 Mbps") && !mikrotikProfiles.some(p => p.name === "5 Mbps") && (
                              <option value="5 Mbps">⚡ 5 Mbps (5M/5M - Default)</option>
                            )}
                            {/* Profil dari DB */}
                            {dbProfiles.filter(p => p.isActive).length > 0 && (
                              <optgroup label="📋 Profil Tersimpan">
                                {dbProfiles.filter(p => p.isActive).map(p => (
                                  <option key={`db-${p.id}`} value={p.name}>
                                    {p.name} ({p.rateLimit})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {/* Profil dari Mikrotik yang belum ada di DB */}
                            {mikrotikProfiles.filter(mp => !dbProfiles.some(dp => dp.name === mp.name)).length > 0 && (
                              <optgroup label="🔧 Profil Mikrotik">
                                {mikrotikProfiles
                                  .filter(mp => !dbProfiles.some(dp => dp.name === mp.name))
                                  .map(p => (
                                    <option key={`mt-${p.name}`} value={p.name}>
                                      {p.name}{p.rateLimit ? ` (${p.rateLimit})` : ''}
                                    </option>
                                  ))}
                              </optgroup>
                            )}
                            <option value="__custom__">✏️ Kustom / Input Manual Mbps</option>
                          </select>

                          {/* Form Input Manual Mbps */}
                          {crudForm.profile === "__custom__" ? (
                            <div className="mt-3 p-4 bg-primary bg-opacity-10 border border-primary-subtle rounded-4 shadow-sm">
                              <small className="fw-bold text-primary d-block mb-3 fs-6"><i className="bi bi-sliders me-2"></i> Konfigurasi Kecepatan Manual</small>
                              <div className="mb-3">
                                <label className="form-label small fw-bold text-secondary mb-1">Nama Profil Baru</label>
                                <input
                                  type="text"
                                  className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                                  placeholder="contoh: 35 Mbps, Paket Kustom"
                                  value={crudForm.customProfileName}
                                  onChange={e => setCrudForm(f => ({ ...f, customProfileName: e.target.value }))}
                                  required={crudForm.profile === "__custom__"}
                                />
                              </div>
                              <div>
                                <label className="form-label small fw-bold text-secondary mb-1">Limit Kecepatan (Rate Limit)</label>
                                <input
                                  type="text"
                                  className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                                  placeholder="contoh: 35M/35M atau 10240k/10240k"
                                  value={crudForm.customRateLimit}
                                  onChange={e => setCrudForm(f => ({ ...f, customRateLimit: e.target.value }))}
                                  required={crudForm.profile === "__custom__"}
                                />
                                <div className="form-text text-muted mt-1 small"><i className="bi bi-info-circle me-1"></i> Format: [Upload]/[Download]. Contoh: 35M/35M</div>
                              </div>
                            </div>
                          ) : crudForm.profile ? (() => {
                            const dbMatch = dbProfiles.find(p => p.name === crudForm.profile);
                            const mtMatch = mikrotikProfiles.find(p => p.name === crudForm.profile);
                            const rate = dbMatch?.rateLimit || mtMatch?.rateLimit || (crudForm.profile === "5 Mbps" ? "5M/5M" : null);
                            return rate ? (
                              <div className="mt-3 p-3 border border-primary-subtle bg-primary bg-opacity-10 rounded-4 shadow-sm d-flex align-items-center gap-2">
                                <i className="bi bi-lightning-charge-fill text-primary fs-5"></i>
                                <div><small className="text-secondary fw-medium">Batas Kecepatan:</small> <strong className="text-primary">{rate}</strong></div>
                              </div>
                            ) : null;
                          })() : null}
                        </>
                      ) : (
                        <input
                          type="text"
                          className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                          placeholder="contoh: default, 10Mbps (ketik manual)"
                          value={crudForm.profile}
                          onChange={(e) => setCrudForm(f => ({ ...f, profile: e.target.value }))}
                        />
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Remote IP Address (IP Pelanggan)</label>
                      <input
                        type="text"
                        className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                        placeholder="contoh: 192.168.10.50 (opsional)"
                        value={crudForm.remoteAddress}
                        onChange={(e) => setCrudForm(f => ({ ...f, remoteAddress: e.target.value }))}
                      />
                      <div className="form-text text-muted mt-1 small"><i className="bi bi-info-circle me-1"></i> Kosongkan untuk menggunakan IP otomatis dari Pool</div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Local IP Address (IP Gateway)</label>
                      <input
                        type="text"
                        className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                        placeholder="contoh: 192.168.10.1 (opsional)"
                        value={crudForm.localAddress}
                        onChange={(e) => setCrudForm(f => ({ ...f, localAddress: e.target.value }))}
                      />
                      <div className="form-text text-muted mt-1 small"><i className="bi bi-info-circle me-1"></i> Kosongkan untuk mengikuti gateway profil</div>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-bold text-secondary mb-1">
                        <i className="bi bi-card-text me-1 text-secondary"></i> Catatan / Keterangan Pelanggan
                      </label>
                      <textarea
                        className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                        rows={2}
                        placeholder="Nama lengkap, alamat rumah, nomor telepon, dll."
                        value={crudForm.keterangan}
                        onChange={(e) => setCrudForm(f => ({ ...f, keterangan: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                {/* ─── TAB: LOKASI GPS (Peta Interaktif) ─── */}
                {crudTab === 'lokasi' && (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <small className="text-muted fw-medium">
                        <i className="bi bi-hand-index me-1 text-primary"></i>
                        Klik pada peta untuk menentukan koordinat akurat rumah pelanggan
                      </small>
                      {crudForm.latitude && crudForm.longitude && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger rounded-3 py-1 px-2 shadow-sm"
                          onClick={() => setCrudForm(f => ({ ...f, latitude: "", longitude: "" }))}
                        >
                          <i className="bi bi-x-circle me-1"></i>Hapus Pin
                        </button>
                      )}
                    </div>
                    <div className="rounded-4 overflow-hidden border border-secondary-subtle shadow-sm mb-3">
                      <MapPicker
                        key={`crud-map-${crudModal}-${crudTab}`}
                        lat={crudForm.latitude}
                        lng={crudForm.longitude}
                        height={300}
                        onChange={(lat, lng) => setCrudForm(f => ({
                          ...f,
                          latitude: lat === "" ? "" : Number(lat).toFixed(7),
                          longitude: lng === "" ? "" : Number(lng).toFixed(7),
                        }))}
                      />
                    </div>
                    {crudForm.latitude && crudForm.longitude && (
                      <div className="d-flex justify-content-end">
                        <a
                          href={`https://maps.google.com/?q=${crudForm.latitude},${crudForm.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline-success rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1 fw-medium"
                        >
                          <i className="bi bi-box-arrow-up-right"></i> Buka di Google Maps
                        </a>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* FOOTER */}
              <div className="modal-footer py-3 px-4 bg-light border-top border-secondary-subtle">
                <button type="button" className="btn btn-secondary rounded-3 px-4 py-2 fw-medium shadow-sm" onClick={() => setCrudModal(false)}>
                  Batal
                </button>
                <button
                  type="button"
                  className="btn btn-primary rounded-3 px-4 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2"
                  onClick={handleCrudSubmit}
                  disabled={crudLoading}
                >
                  {crudLoading ? (
                    <><span className="spinner-border spinner-border-sm" role="status"></span> Menyimpan...</>
                  ) : (
                    <><i className="bi bi-check-lg"></i> {crudMode === 'add' ? 'Tambah User' : 'Simpan Perubahan'}</>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}