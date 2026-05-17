import { useMemo, useState, useEffect } from "react";
import api from "../../services/api";
import { socket } from "../../services/socket";
import { parseOnlineStatus, parseUptime } from "./utils";

/* ───────────────── STATUS BADGE ───────────────── */
export const StatusBadge = ({ online }) => (
  <span
    className={`badge rounded-pill px-3 py-2 ${
      online
        ? "bg-success-subtle text-success-emphasis"
        : "bg-danger-subtle text-danger-emphasis"
    }`}
  >
    <i
      className={`bi bi-circle-fill me-1 ${
        online ? "text-success" : "text-danger"
      }`}
      style={{ fontSize: "0.6rem" }}
    />
    {online ? "Online" : "Offline"}
  </span>
);

/* ───────────────── CONNECTION BADGE ───────────────── */
export const ConnectionBadge = ({ connected }) => (
  <span
    className={`badge rounded-pill px-3 py-2 ${
      connected
        ? "bg-success-subtle text-success-emphasis"
        : "bg-danger-subtle text-danger-emphasis"
    }`}
  >
    <i className={`bi bi-wifi me-1 ${connected ? "" : "opacity-50"}`} />
    {connected ? "Connected" : "Disconnected"}
  </span>
);

/* ───────────────── TRAFFIC ───────────────── */
const formatTraffic = (value = 0) => {
  const n = Number(value || 0);
  if (!isFinite(n) || n <= 0) return "0 bps";

  const units = ["bps", "Kbps", "Mbps", "Gbps", "Tbps"];

  let i = 0;
  let v = n;

  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }

  return `${v.toFixed(2)} ${units[i]}`;
};

/* ───────────────── HOOK ───────────────── */
export const usePppoeUserMonitor = (selectedRouter) => {
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");

  // socketRef is not needed

  /* ───────── LOAD USERS ───────── */
  const loadUsers = async (routerId) => {
    if (!routerId) return;

    setUsersLoading(true);

    try {
      const res = await api.get(`/pppoe/${routerId}`);
      const raw = res.data?.data || [];

      setUsers(
        raw.map((u) => ({
          id: u.id,
          username: u.username || "-",
          profile: u.profile || "",
          keterangan: u.keterangan || "",

          localAddress: u.localAddress || "",
          remoteAddress: u.remoteAddress || "",
          ip: u.localAddress || u.remoteAddress || "-",

          isOnline: parseOnlineStatus(u.isOnline),

          rx: Number(u.rxRaw ?? u.rx ?? 0),
          tx: Number(u.txRaw ?? u.tx ?? 0),

          uptime: u.uptime || "-",
          downtime: u.downtime || "-",   // ✔ tetap raw dari backend

          latitude: u.latitude ?? null,
          longitude: u.longitude ?? null,
          topologyNodeId: u.topologyNodeId ?? null,
        }))
      );
    } catch (err) {
      console.error("PPPoE load error:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  /* ───────── AUTO LOAD USERS ON ROUTER CHANGE ───────── */
  useEffect(() => {
    if (selectedRouter) {
      loadUsers(selectedRouter);
    }
  }, [selectedRouter]);

  /* ───────── SOCKET REALTIME UPDATE ───────── */
  useEffect(() => {
    if (!selectedRouter) return;

    const handler = (msg) => {
      // Filter hanya untuk router yang sedang aktif
      if (Number(msg?.routerId) !== Number(selectedRouter)) return;

      const data = msg?.data;
      if (!Array.isArray(data)) return;

      setUsers((prev) => {
        const map = new Map(prev.map((u) => [u.id, u]));

        for (const r of data) {
          const old = map.get(r.id) || {};
          const isOnline = !!r.isOnline;

          map.set(r.id, {
            ...old,
            id: r.id,
            username: r.username || old.username,
            profile: r.profile || old.profile || "",
            keterangan: r.keterangan || old.keterangan || "",
            isOnline,
            ip: r.localAddress || r.remoteAddress || old.ip || "-",
            rx: Number(r.rxBps ?? r.rxRaw ?? old.rx ?? 0),
            tx: Number(r.txBps ?? r.txRaw ?? old.tx ?? 0),
            uptime: isOnline ? (r.uptime || "-") : "-",
            downtime: !isOnline ? (r.downtime || "-") : "-",
            latitude: old.latitude ?? null,
            longitude: old.longitude ?? null,
          });
        }

        return Array.from(map.values());
      });
    };

    socket.on("pppoe-realtime", handler);
    return () => socket.off("pppoe-realtime", handler);
  }, [selectedRouter]);

  /* ───────── FILTER ───────── */
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => {
        const name = (u.username || "").toLowerCase();

        if (searchQuery && !name.includes(searchQuery.toLowerCase()))
          return false;

        if (filterStatus === "online" && !u.isOnline) return false;
        if (filterStatus === "offline" && u.isOnline) return false;

        if (
          locationFilter === "has-location" &&
          (!u.latitude || !u.longitude)
        )
          return false;

        if (
          locationFilter === "no-location" &&
          u.latitude &&
          u.longitude
        )
          return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name-asc")
          return a.username.localeCompare(b.username);
        if (sortBy === "name-desc")
          return b.username.localeCompare(a.username);
        if (sortBy === "uptime-desc")
          return parseUptime(b.uptime) - parseUptime(a.uptime);
        if (sortBy === "uptime-asc")
          return parseUptime(a.uptime) - parseUptime(b.uptime);

        return 0;
      });
  }, [users, searchQuery, filterStatus, locationFilter, sortBy]);

  const onlineUsers = useMemo(
    () => filteredUsers.filter((u) => u.isOnline).length,
    [filteredUsers]
  );

  return {
    users,
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

    StatusBadge,
    ConnectionBadge,

    formatTraffic,
  };
};