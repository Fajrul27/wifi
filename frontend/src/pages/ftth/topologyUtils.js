import { CABLE_LABELS, SPLITTER_LABELS } from "./topologyConstants";

// ─────────────────────────────────────────────────────────────
// TOPOLOGY UTILITIES
// Helper functions for formatting, GPS distance calculation, etc.
// ─────────────────────────────────────────────────────────────

export const extractDataArray = (response) => {
  if (!response?.data) return [];
  if (Array.isArray(response.data.data)) return response.data.data;
  if (Array.isArray(response.data)) return response.data;
  return [];
};

export const getCableLabel = (type) => {
  return CABLE_LABELS[type] || type;
};

export const getSplitterLabel = (type) => {
  return SPLITTER_LABELS[type] || type;
};

export const formatCoord = (val) => (val ? parseFloat(val).toFixed(4) : '-');

// Helper hitung jarak GPS (meter) menggunakan formula Haversine
export const getDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
};
