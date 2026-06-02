import { useEffect, useRef, useState, useCallback } from "react";
import api from "../../../services/api";
import { getLimitByRange } from "../utils";

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
  const wsRef = useRef(null);

  const [socketConnected, setSocketConnected] = useState(false);
  const [isRouterConnected, setIsRouterConnected] = useState(false);
  const [routers, setRouters] = useState([]);

  const [metrics, setMetrics] = useState({
    labels: [],
    cpuData: [],
    ramData: [],
    rxData: [],
    txData: [],
    latest: { cpu: 0, ram: 0, rx: 0, tx: 0 },
  });

  // Reset metrics when selectedRouter changes to prevent displaying stale metrics of the previous router
  useEffect(() => {
    setMetrics({
      labels: [],
      cpuData: [],
      ramData: [],
      rxData: [],
      txData: [],
      latest: { cpu: 0, ram: 0, rx: 0, tx: 0 },
    });
  }, [selectedRouter]);

  // Sync initial isRouterConnected state from routers array when selectedRouter changes
  useEffect(() => {
    if (selectedRouter && routers.length > 0) {
      const activeRouter = routers.find((r) => Number(r.id) === Number(selectedRouter));
      if (activeRouter) {
        setIsRouterConnected(!!activeRouter.isOnline);
      } else {
        setIsRouterConnected(false);
      }
    } else {
      setIsRouterConnected(false);
    }
  }, [selectedRouter, routers]);

  /* ───────────── LOAD ROUTERS ───────────── */
  const loadRouters = useCallback(async () => {
    const res = await api.get("/routers");
    const data = res.data?.data || res.data || [];
    setRouters(data);
    return data;
  }, []);

  /* ───────────── WEBSOCKET REALTIME ───────────── */
  useEffect(() => {
    if (!selectedRouter) return;

    let ws;
    let reconnect;

    const connect = () => {
      ws = new WebSocket("ws://localhost:5050");
      wsRef.current = ws;

      ws.onopen = () => setSocketConnected(true);

      ws.onclose = () => {
        setSocketConnected(false);
        reconnect = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (Number(msg.routerId) !== Number(selectedRouter)) return;

          if (msg.type === "router-realtime") {
            setIsRouterConnected(true);

            const s = msg.data?.system || {};
            const t = msg.data?.traffic || {};

            const time = new Date().toLocaleTimeString();

            /* ───────────── FIXED RX/TX ───────────── */
            const rx = normalizeTraffic(
              t.rxRaw ?? t.rx ?? t.rxBps ?? 0
            );

            const tx = normalizeTraffic(
              t.txRaw ?? t.tx ?? t.txBps ?? 0
            );

            const cpu = toNumber(s.cpuLoad);

            /* ───────────── RAM FIXED ───────────── */
            const ram =
              s.totalMemory && s.freeMemory
                ? ((s.totalMemory - s.freeMemory) / s.totalMemory) * 100
                : toNumber(s.ramUsage ?? s.ram ?? 0);

            const limit = getLimitByRange(timeRange || "1h");

            setMetrics((prev) => ({
              labels: [...prev.labels, time].slice(-limit),
              cpuData: [...prev.cpuData, cpu].slice(-limit),
              ramData: [...prev.ramData, ram].slice(-limit),
              rxData: [...prev.rxData, rx].slice(-limit),
              txData: [...prev.txData, tx].slice(-limit),
              latest: {
                cpu,
                ram,
                rx,
                tx,
              },
            }));
          } else if (msg.type === "router-status") {
            setIsRouterConnected(!!msg.data?.isOnline);
          }
        } catch (e) {
          console.error("WS ERROR:", e);
        }
      };
    };

    connect();

    return () => {
      clearTimeout(reconnect);
      ws?.close();
    };
  }, [selectedRouter, timeRange]);

  return {
    routers,
    loadRouters,
    metrics,
    socketConnected,
    isRouterConnected,
  };
};