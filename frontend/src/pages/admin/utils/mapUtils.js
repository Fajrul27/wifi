import L from 'leaflet';

export const iconAnchor = [14, 14];
export const popupAnchor = [0, -14];

const iconCache = {};

export const createCustomIcon = (color, iconClass, isOffline = false) => {
  const cacheKey = `${color}-${iconClass}-${isOffline}`;
  if (iconCache[cacheKey]) {
    return iconCache[cacheKey];
  }

  const pulseHtml = isOffline ? `
    <div style="
      position: absolute;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(239, 68, 68, 0.35);
      border: 2px solid rgba(239, 68, 68, 0.8);
      animation: radar-pulse 1.8s infinite ease-out;
      z-index: 1;
    "></div>
  ` : '';

  const icon = L.divIcon({
    className: "custom-marker",
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;">
        ${pulseHtml}
        <div style="
          background: ${color};
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 3px 8px rgba(0,0,0,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          z-index: 10;
        "><i class="bi ${iconClass}"></i></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor,
    popupAnchor,
  });

  iconCache[cacheKey] = icon;
  return icon;
};

export const MARKER_CONFIG = {
  router: { color: "#0ea5e9", icon: "bi-router-fill", label: "Router" },
  oltPort: { color: "#2563eb", icon: "bi-hdd-rack-fill", label: "OLT Port" },
  ODC: { color: "#8b5cf6", icon: "bi-hdd-network-fill", label: "ODC" },
  ODP: { color: "#f59e0b", icon: "bi-modem-fill", label: "ODP", textColor: "#212529" },
  splitter: { color: "#ea580c", icon: "bi-diagram-3-fill", label: "Splitter" },
  client: { color: "#10b981", icon: "bi-pc-display-horizontal", label: "Client" },
};

export const isValidCoord = (lat, lng) => {
  const lt = parseFloat(lat);
  const lg = parseFloat(lng);
  return !isNaN(lt) && !isNaN(lg) && lt !== 0 && lg !== 0 && lt >= -90 && lt <= 90 && lg >= -180 && lg <= 180;
};
