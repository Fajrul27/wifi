import { useGlobalRealtime } from "../../../context/GlobalRealtimeContext";

/* ─────────────────────────────
   HOOK MONITOR (GLOBALIZED BACKGROUND PERSISTENT)
───────────────────────────── */
export const useRouterMonitor = (selectedRouter, timeRange) => {
  const { routers, metrics, monitorSocketConnected, isRouterConnected } = useGlobalRealtime();

  return {
    routers,
    loadRouters: async () => routers,
    metrics,
    socketConnected: monitorSocketConnected,
    isRouterConnected,
  };
};