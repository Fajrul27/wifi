import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import api from "../../../services/api";
import { parseOnlineStatus, parseUptime } from "../utils";
import { useGlobalRealtime } from "../../../context/GlobalRealtimeContext";

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
  const { pppoeUsers: users, setPppoeUsers: setUsers } = useGlobalRealtime();
  
  // usersLoading can just be derived from whether users array is empty while not initialized
  // But context handles this instantly if cached
  const [usersLoading, setUsersLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");

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
        ip: u.localAddress || u.remoteAddress || null,
        isOnline: parseOnlineStatus(u.isOnline),
        disabled: !!u.disabled,
        rx: Number(u.rxRaw ?? u.rx ?? 0),
        tx: Number(u.txRaw ?? u.tx ?? 0),
        uptime: u.uptime || "-",
        downtime: u.downtime || "-",
        lastSeen: u.lastSeen || null,
        lastDisconnect: u.lastDisconnect || null,
        createdAt: u.createdAt || null,
        realtimeUpdatedAt: Date.now(),
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
  }, [setUsers]);

  /* ───────── CLEANUP ON UNMOUNT ───────── */
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);


  /* ───────── FILTER & SORT ───────── */
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => Number(u.routerId) === Number(selectedRouter))
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
  }, [users, selectedRouter, searchQuery, filterStatus, locationFilter, sortBy]);

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
