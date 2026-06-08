import L from 'leaflet';

export const iconAnchor = [14, 14];
export const popupAnchor = [0, -14];

const iconCache = {};

export const createCustomIcon = (color, iconClass, isOffline = false, markerType = '') => {
  const cacheKey = `${color}-${iconClass}-${isOffline}-${markerType}`;
  if (iconCache[cacheKey]) {
    return iconCache[cacheKey];
  }

  const pulseHtml = isOffline ? `
    <div class="radar-ripple"></div>
  ` : '';

  const icon = L.divIcon({
    className: `custom-marker ${markerType}`,
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

export const sanitizeCoordinates = (coords) => {
  if (typeof coords === "string") {
    try {
      coords = JSON.parse(coords);
    } catch {
      return null;
    }
  }

  if (coords?.type === "LineString" && Array.isArray(coords.coordinates)) {
    coords = coords.coordinates;
  } else if (Array.isArray(coords?.coordinates)) {
    coords = coords.coordinates;
  }

  if (!Array.isArray(coords)) return null;
  const valid = [];
  for (let i = 0; i < coords.length; i++) {
    const pt = coords[i];
    if (Array.isArray(pt) && pt.length >= 2) {
      const lat = Number(pt[0]);
      const lng = Number(pt[1]);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        valid.push([lat, lng]);
      } else {
        const swappedLat = Number(pt[1]);
        const swappedLng = Number(pt[0]);
        if (!isNaN(swappedLat) && !isNaN(swappedLng) && swappedLat !== 0 && swappedLng !== 0 && swappedLat >= -90 && swappedLat <= 90 && swappedLng >= -180 && swappedLng <= 180) {
          valid.push([swappedLat, swappedLng]);
        }
      }
    } else if (pt && typeof pt === 'object') {
      const lat = Number(pt.lat ?? pt.latitude);
      const lng = Number(pt.lng ?? pt.longitude);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        valid.push([lat, lng]);
      }
    }
  }
  return valid.length >= 2 ? valid : null;
};

export const buildCableCoordinates = (routeCoords, startLat, startLng, endLat, endLng) => {
  const routed = sanitizeCoordinates(routeCoords);
  if (routed) return routed;

  if (!isValidCoord(startLat, startLng) || !isValidCoord(endLat, endLng)) {
    return null;
  }

  return [
    [Number(startLat), Number(startLng)],
    [Number(endLat), Number(endLng)],
  ];
};

export const getMapEntityStatus = (entity, type, context = {}) => {
  const {
    routers = [],
    hasOnlineUser,
  } = context;

  if (!entity) {
    return { isOnline: false, label: "Offline", color: "#ef4444", badgeClass: "bg-danger" };
  }

  let isOnline = false;

  if (type === "router" || entity.type === "Router") {
    isOnline = entity.isOnline === true;
  } else if (type === "client" || entity.username) {
    isOnline = entity.isOnline === true;
  } else if (type === "oltPort" || entity.type === "oltPort") {
    const router = entity.router || routers.find((r) => Number(r.id) === Number(entity.routerId));
    isOnline = router?.isOnline === true;
  } else if (type === "node" || entity.type === "ODC" || entity.type === "ODP") {
    if (typeof entity.isOnline === "boolean") {
      isOnline = entity.isOnline;
    } else if (typeof hasOnlineUser === "function") {
      isOnline = hasOnlineUser(entity.id) === true;
    }
  }

  return {
    isOnline,
    label: isOnline ? "Online" : "Offline",
    color: isOnline ? "#10b981" : "#ef4444",
    badgeClass: isOnline ? "bg-success" : "bg-danger",
  };
};
