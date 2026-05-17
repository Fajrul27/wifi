import { useEffect, useMemo, useState } from "react";
import { useRouterMonitor } from "./RouterMonitor";
import api from "../../services/api";
import {
  usePppoeUserMonitor,
  ConnectionBadge,
} from "./PppoeUserMonitor";
import PppoeModals from "./components/PppoeModals";
import PppoeNotifications from "./components/PppoeNotifications";

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
  /* ───────────────── STATE & NOTIFICATIONS ───────────────── */
  const [selectedRouter, setSelectedRouter] = useState(null);
  const [routers, setRouters] = useState([]);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [confirm, setConfirm] = useState({ show: false, message: "", onConfirm: null });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const showConfirm = (message, onConfirm) => {
    setConfirm({ show: true, message, onConfirm });
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        showToast("User berhasil ditambahkan!", "success");
      } else {
        // Gunakan endpoint /full untuk update profile + password + lokasi sekaligus
        await api.put(`/pppoe/${selectedRouter}/user/${crudUser.id}/full`, payload);
        showToast("User berhasil diperbarui!", "success");
      }
      setCrudModal(false);
      loadUsers(selectedRouter);
    } catch (err) {
      setCrudError(err.response?.data?.message || err.message);
      showToast("Gagal menyimpan user", "danger");
    } finally {
      setCrudLoading(false);
    }
  };

  const handleDelete = async (user) => {
    showConfirm(`Hapus user "${user.username}" dari Mikrotik dan database?`, async () => {
      try {
        await api.delete(`/pppoe/${selectedRouter}/user/${user.id}`);
        loadUsers(selectedRouter);
        showToast(`User "${user.username}" berhasil dihapus`, "success");
      } catch (err) {
        showToast(err.response?.data?.message || "Gagal menghapus user", "danger");
      }
    });
  };

  const handleKick = async (user) => {
    showConfirm(`Putuskan sesi aktif "${user.username}"?`, async () => {
      try {
        await api.post(`/pppoe/${selectedRouter}/user/${user.id}/kick`);
        showToast(`Sesi ${user.username} berhasil diputus`, "success");
      } catch (err) {
        showToast(err.response?.data?.message || "Gagal memutus sesi", "danger");
      }
    });
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
      showToast("Sinkronisasi Mikrotik berhasil!", "success");
    } catch (err) {
      console.error(err);
      showToast("Sync failed", "danger");
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
      showToast("Lokasi pelanggan berhasil diperbarui!", "success");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Gagal update lokasi", "danger");
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
  // Summary counts not needed here

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
                <th>Uptime / Downtime</th>
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
                    <td>
                      {u.isOnline ? (
                        <span className="text-success fw-semibold d-flex align-items-center gap-1">
                          <i className="bi bi-clock"></i> {u.uptime}
                        </span>
                      ) : (
                        <span className="text-danger fw-medium small d-flex align-items-center gap-1">
                          <i className="bi bi-clock-history"></i> {u.downtime || "-"}
                        </span>
                      )}
                    </td>
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

      {/* MODALS */}
      <PppoeModals
        showLocationModal={showLocationModal}
        closeLocationModal={closeLocationModal}
        selectedUser={selectedUser}
        latitude={latitude}
        setLatitude={setLatitude}
        longitude={longitude}
        setLongitude={setLongitude}
        saveLocation={saveLocation}
        savingLocation={savingLocation}
        crudModal={crudModal}
        setCrudModal={setCrudModal}
        crudMode={crudMode}
        crudUser={crudUser}
        crudForm={crudForm}
        setCrudForm={setCrudForm}
        crudError={crudError}
        crudTab={crudTab}
        setCrudTab={setCrudTab}
        mikrotikProfiles={mikrotikProfiles}
        dbProfiles={dbProfiles}
        profilesLoading={profilesLoading}
        handleCrudSubmit={handleCrudSubmit}
        crudLoading={crudLoading}
      />

      {/* NOTIFICATIONS */}
      <PppoeNotifications
        toast={toast}
        setToast={setToast}
        confirm={confirm}
        setConfirm={setConfirm}
      />

    </div>
  );
}