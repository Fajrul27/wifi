import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import api from "../../../services/api";
import { parseOnlineStatus, parseUptime } from "../utils";

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
export const formatTraffic = (value = 0) => {
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

  const socketRef = useRef(null);
  const isMountedRef = useRef(true);

  /* ───────── LOAD USERS ───────── */
  const loadUsers = useCallback(async (routerId) => {
    if (!routerId) return null;

    if (!isMountedRef.current) return null;
    setUsersLoading(true);

    try {
      const res = await api.get(`/pppoe/${routerId}`);
      const raw = res.data?.data || [];

      const processed = raw.map((u) => ({
        id: u.id,
        username: u.username || "-",
        profile: u.profile || "-",
        ip: u.localAddress || u.remoteAddress || "-",
        isOnline: parseOnlineStatus(u.isOnline),
        rx: Number(u.rxRaw ?? u.rx ?? 0),
        tx: Number(u.txRaw ?? u.tx ?? 0),
        uptime: u.uptime || "-",
        downtime: u.downtime || "-",
        latitude: u.latitude ?? null,
        longitude: u.longitude ?? null,
        service: u.service || null,
        remoteAddress: u.remoteAddress || null,
        localAddress: u.localAddress || null,
      }));

      if (isMountedRef.current) {
        setUsers(processed);
      }

      return { users: processed, metrics: res.data?.metrics || {} };
    } catch (err) {
      console.error("PPPoE load error:", err);
      return null;
    } finally {
      if (isMountedRef.current) {
        setUsersLoading(false);
      }
    }
  }, []);

  /* ───────── SET CACHED USERS (FOR PERSISTENT CACHE) ───────── */
  // Fungsi ini dipanggil dari dashboard saat ada update dari background monitoring
  const setCachedUsers = useCallback((newUsers) => {
    if (!Array.isArray(newUsers)) return;
    
    if (isMountedRef.current) {
      setUsers(newUsers.map((u) => ({
        id: u.id,
        username: u.username || "-",
        profile: u.profile || "-",
        ip: u.localAddress || u.remoteAddress || "-",
        isOnline: parseOnlineStatus(u.isOnline),
        rx: Number(u.rxRaw ?? u.rx ?? 0),
        tx: Number(u.txRaw ?? u.tx ?? 0),
        uptime: u.uptime || "-",
        downtime: u.downtime || "-",
        latitude: u.latitude ?? null,
        longitude: u.longitude ?? null,
        service: u.service || null,
        remoteAddress: u.remoteAddress || null,
        localAddress: u.localAddress || null,
      })));
    }
  }, []);

  /* ───────── SOCKET UPDATE ───────── */
  useEffect(() => {
    if (!selectedRouter) return;

    isMountedRef.current = true;
    const socket = window.socket;
    if (!socket) return;

    socketRef.current = socket;

    const handler = (msg) => {
      if (msg?.type !== "pppoe-realtime") return;
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
            profile: r.profile || old.profile,
            isOnline,
            ip: r.localAddress || r.remoteAddress || old.ip || "-",
            rx: Number(r.rxBps ?? r.rxRaw ?? old.rx ?? 0),
            tx: Number(r.txBps ?? r.txRaw ?? old.tx ?? 0),
            uptime: isOnline ? r.uptime || "-" : "-",
            downtime: !isOnline
              ? (r.downtime && r.downtime !== "0s" ? r.downtime : "0s")
              : "-",
            latitude: old.latitude ?? null,
            longitude: old.longitude ?? null,
            service: r.service || old.service,
            remoteAddress: r.remoteAddress || old.remoteAddress,
            localAddress: r.localAddress || old.localAddress,
          });
        }

        return Array.from(map.values());
      });
    };

    socket.on("pppoe-realtime", handler);

    return () => {
      socket.off("pppoe-realtime", handler);
    };
  }, [selectedRouter]);

  /* ───────── CLEANUP ON UNMOUNT ───────── */
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /* ───────── FILTER & SORT ───────── */
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
    setCachedUsers, // ← Export untuk persistent cache dari dashboard

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