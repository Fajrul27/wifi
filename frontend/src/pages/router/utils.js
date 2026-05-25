// src/components/pppoe-monitoring/utils.js

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ───────────────── CONFIG ─────────────────
export const TIME_RANGES = [
  { label: "1 Jam", value: "1h", limit: 720 },
  { label: "6 Jam", value: "6h", limit: 1500 },
  { label: "12 Jam", value: "12h", limit: 3000 },
];

export const CACHE_KEY = "pppoe-dashboard-cache-v2";

// ───────────────── SAFE NUMBER ─────────────────
export const safeNumber = (v) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

// ───────────────── FIXED TRAFFIC FORMAT (IMPORTANT) ─────────────────
export const formatTraffic = (bps = 0) => {
  let value = safeNumber(bps);

  if (value <= 0) return "0 bps";

  /**
   * FIX PENTING:
   * MikroTik sometimes already sends bps,
   * jangan di-scale manual terlalu agresif
   */
  if (value > 1e12) value = value / 1e9;
  else if (value > 1e9) value = value / 1e6;

  const units = ["bps", "Kbps", "Mbps", "Gbps", "Tbps"];

  let i = 0;

  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }

  return `${value.toFixed(2)} ${units[i]}`;
};

// ───────────────── OPTIONAL CHART VALUE ─────────────────
export const formatMbps = (bps = 0) => {
  const value = safeNumber(bps);
  return value / 1_000_000;
};

// ───────────────── UPTIME PARSER ─────────────────
export const parseUptime = (uptime = "") => {
  if (!uptime) return 0;

  let total = 0;

  const d = uptime.match(/(\d+)d/);
  const h = uptime.match(/(\d+)h/);
  const m = uptime.match(/(\d+)m/);
  const s = uptime.match(/(\d+)s/);

  if (d) total += Number(d[1]) * 86400;
  if (h) total += Number(h[1]) * 3600;
  if (m) total += Number(m[1]) * 60;
  if (s) total += Number(s[1]);

  return total;
};

// ───────────────── RANGE LIMIT ─────────────────
export const getLimitByRange = (range) =>
  TIME_RANGES.find((x) => x.value === range)?.limit ?? 60;

// ───────────────── USER CLEANER ─────────────────
export const normalizeUsername = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/^pppoe-/, "")
    .replace(/^<pppoe-/, "")
    .replace(/>$/, "");

// ───────────────── FIXED STATUS PARSER (IMPORTANT) ─────────────────
export const parseOnlineStatus = (value) => {
  if (value === true || value === "true" || value === 1 || value === "1")
    return true;

  return false;
};