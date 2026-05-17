import { useEffect, useState } from "react";
import api from "../../services/api";
import { getLimitByRange } from "./utils";

/* ─────────────────────────────
   SAFE NUMBER
───────────────────────────── */
const toNumber = (v) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

/* ─────────────────────────────
   STRICT TRAFFIC NORMALIZER (FINAL FIX)
   -> semua jadi NUMBER (bps)
───────────────────────────── */
const normalizeTraffic = (v) => {
  if (v == null) return 0;

  if (typeof v === "number") return v;

  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? 0 : n;
  }

  if (typeof v === "object") {
    return toNumber(
      v.rxRaw ??
      v.txRaw ??
      v.value ??
      v.bps ??
      0
    );
  }

  return 0;
};

/* ─────────────────────────────
   HOOK MONITOR (FINAL STABLE)
───────────────────────────── */
export const useRouterMonitor = (selectedRouter, timeRange) => {
  // wsRef is not needed

  const [socketConnected, setSocketConnected] = useState(false);
  const [routers, setRouters] = useState([]);

  const [metrics, setMetrics] = useState({
    labels: [],
    cpuData: [],
    ramData: [],
    rxData: [],
    txData: [],
    latest: { cpu: 0, ram: 0, rx: 0, tx: 0 },
  });

  /* ───────────── LOAD ROUTERS ───────────── */
  const loadRouters = async () => {
    const res = await api.get("/routers");
    const data = res.data?.data || res.data || [];
    setRouters(data);
    return data;
  };

  /* ───────────── SOCKET.IO REALTIME ───────────── */
  useEffect(() => {
    if (!selectedRouter) return;

    // Gunakan instance socket dari service socket
    const { socket } = require("../../services/socket"); 

    const handleRealtime = (msg) => {
      try {
        if (Number(msg.routerId) !== Number(selectedRouter)) return;
        
        // Event ini dikirim oleh monitoring.js (global.io.emit)
        const s = msg.data?.system || {};
        const t = msg.data?.traffic || {};
        const time = new Date().toLocaleTimeString();

        const rx = normalizeTraffic(t.rxRaw ?? t.rx ?? t.rxBps ?? 0);
        const tx = normalizeTraffic(t.txRaw ?? t.tx ?? t.txBps ?? 0);
        const cpu = toNumber(s.cpuLoad);
        const ram = s.totalMemory && s.freeMemory
          ? ((s.totalMemory - s.freeMemory) / s.totalMemory) * 100
          : toNumber(s.ramUsage ?? s.ram ?? 0);

        const limit = getLimitByRange(timeRange || "1h");

        setMetrics((prev) => ({
          labels: [...prev.labels, time].slice(-limit),
          cpuData: [...prev.cpuData, cpu].slice(-limit),
          ramData: [...prev.ramData, ram].slice(-limit),
          rxData: [...prev.rxData, rx].slice(-limit),
          txData: [...prev.txData, tx].slice(-limit),
          latest: { cpu, ram, rx, tx },
        }));
      } catch (e) {
        console.error("SOCKET ERROR:", e);
      }
    };

    socket.on("router-realtime", handleRealtime);
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    
    // Set initial state jika socket sudah konek
    setSocketConnected(socket.connected);

    return () => {
      socket.off("router-realtime", handleRealtime);
    };
  }, [selectedRouter, timeRange]);

  return {
    routers,
    loadRouters,
    metrics,
    socketConnected,
  };
};