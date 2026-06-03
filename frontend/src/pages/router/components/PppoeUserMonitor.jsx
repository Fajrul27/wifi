import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import api from "../../../services/api";
import { parseOnlineStatus, parseUptime } from "../utils";
import { socket } from "../../../services/socket";

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

/* ───────────────── GLOBAL CACHE ───────────────── */
// This persists the data across page navigations without needing sessionStorage
const globalUsersCache = {};
const globalLoadingState = {};

let isGlobalSocketInitialized = false;
const globalStateSetters = new Set();
const joinedRouters = new Set();

const initGlobalSocket = (socket) => {
  if (isGlobalSocketInitialized || !socket) return;
  isGlobalSocketInitialized = true;
  
  socket.on("pppoe-realtime", (msg) => {
    if (msg?.type !== "pppoe-realtime") return;
    const rId = msg.routerId ? Number(msg.routerId) : null;
    const data = msg?.data;
    if (!Array.isArray(data) || !rId) return;

    const prev = globalUsersCache[rId] || [];
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
        disabled: r.disabled !== undefined ? !!r.disabled : old.disabled,
        ip: r.localAddress || r.remoteAddress || old.ip || "-",
        rx: Number(r.rxBps ?? r.rxRaw ?? old.rx ?? 0),
        tx: Number(r.txBps ?? r.txRaw ?? old.tx ?? 0),
        uptime: isOnline ? r.uptime || "-" : "-",
        downtime: !isOnline
          ? (r.downtime && r.downtime !== "0s" ? r.downtime : "-")
          : "-",
        latitude: old.latitude ?? null,
        longitude: old.longitude ?? null,
        service: r.service || old.service,
        remoteAddress: r.remoteAddress || old.remoteAddress,
        localAddress: r.localAddress || old.localAddress,
      });
    }

    const newArr = Array.from(map.values());
    globalUsersCache[rId] = newArr;
    
    // Notify all active mounted components
    globalStateSetters.forEach(setter => {
      setter(rId, newArr);
    });
  });
};

/* ───────────────── HOOK ───────────────── */
export const usePppoeUserMonitor = (selectedRouter) => {
  const [users, setUsers] = useState(() => globalUsersCache[selectedRouter] || []);
  const [usersLoading, setUsersLoading] = useState(() => 
    selectedRouter ? (globalLoadingState[selectedRouter] || !globalUsersCache[selectedRouter]) : false
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");

  const socketRef = useRef(null);
  const isMountedRef = useRef(true);

  // Sync users when selectedRouter changes
  useEffect(() => {
    if (selectedRouter) {
      if (globalUsersCache[selectedRouter]) {
        setUsers(globalUsersCache[selectedRouter]);
        setUsersLoading(false);
      } else {
        setUsers([]);
        setUsersLoading(true);
      }
    } else {
      setUsers([]);
      setUsersLoading(false);
    }
  }, [selectedRouter]);

  /* ───────── LOAD USERS ───────── */
  const loadUsers = useCallback(async (routerId) => {
    if (!routerId) return null;

    if (!isMountedRef.current) return null;
    
    // Only show loading if we don't have cache
    if (!globalUsersCache[routerId]) {
      setUsersLoading(true);
      globalLoadingState[routerId] = true;
    }

    try {
      const res = await api.get(`/pppoe/${routerId}`);
      const raw = res.data?.data || [];

      const processed = raw.map((u) => ({
        id: u.id,
        username: u.username || "-",
        profile: u.profile || "-",
        ip: u.localAddress || u.remoteAddress || "-",
        isOnline: parseOnlineStatus(u.isOnline),
        disabled: !!u.disabled,
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
      
      // Save to global cache
      globalUsersCache[routerId] = processed;
      globalLoadingState[routerId] = false;

      return { users: processed, metrics: res.data?.metrics || {} };
    } catch (err) {
      console.error("PPPoE load error:", err);
      return null;
    } finally {
      globalLoadingState[routerId] = false;
      if (isMountedRef.current) {
        setUsersLoading(false);
      }
    }
  }, []);

  /* ───────── SET CACHED USERS (FOR PERSISTENT CACHE) ───────── */
  // Fungsi ini dipanggil dari dashboard saat ada update dari background monitoring
  const setCachedUsers = useCallback((newUsers, routerId) => {
    if (!Array.isArray(newUsers)) return;
    
    const processed = newUsers.map((u) => ({
      id: u.id,
      username: u.username || "-",
      profile: u.profile || "-",
      ip: u.localAddress || u.remoteAddress || "-",
      isOnline: parseOnlineStatus(u.isOnline),
      disabled: !!u.disabled,
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

    if (routerId) {
      globalUsersCache[routerId] = processed;
    }

    if (isMountedRef.current) {
      setUsers(processed);
    }
  }, []);

  /* ───────── SOCKET UPDATE ───────── */
  useEffect(() => {
    if (!selectedRouter) return;

    isMountedRef.current = true;
    socketRef.current = socket;

    initGlobalSocket(socket);

    // Join room for this router globally, but NEVER leave it 
    // so background sync continues even when we are on another page!
    if (!joinedRouters.has(selectedRouter)) {
      socket.emit("join-router", selectedRouter);
      joinedRouters.add(selectedRouter);
    }

    const setter = (rId, newArr) => {
      if (Number(rId) === Number(selectedRouter) && isMountedRef.current) {
        setUsers(newArr);
      }
    };

    globalStateSetters.add(setter);

    return () => {
      globalStateSetters.delete(setter);
      // Notice we DO NOT socket.emit("leave-router"). 
      // The websocket remains open and updating globalUsersCache silently in the background!
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