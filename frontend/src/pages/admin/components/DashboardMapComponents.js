import React, { useEffect, useRef } from 'react';
import { useMap, Polyline, Popup, Marker } from 'react-leaflet';
import L from 'leaflet';

// Component to auto-fit map bounds to markers
export function FitMapBounds({ coordinates, selectedRouter }) {
  const map = useMap();
  const prevRouterRef = useRef(selectedRouter);
  const userInteractedRef = useRef(false);
  const isInitialMountRef = useRef(true);
  
  // Reset interaction flag when selectedRouter changes
  useEffect(() => {
    if (prevRouterRef.current !== selectedRouter) {
      prevRouterRef.current = selectedRouter;
      userInteractedRef.current = false;
    }
  }, [selectedRouter]);

  // Listen for user manual zoom/drag to disable auto-fitting
  useEffect(() => {
    const container = map.getContainer();
    const handleInteraction = () => {
      userInteractedRef.current = true;
    };
    
    container.addEventListener("mousedown", handleInteraction);
    container.addEventListener("touchstart", handleInteraction, { passive: true });
    container.addEventListener("wheel", handleInteraction, { passive: true });
    
    return () => {
      container.removeEventListener("mousedown", handleInteraction);
      container.removeEventListener("touchstart", handleInteraction);
      container.removeEventListener("wheel", handleInteraction);
    };
  }, [map]);

  // Stable key = serialized sorted lat,lng pairs — only changes when positions actually change
  const coordKeyRef = useRef("");
  const hasFlownRef = useRef(false);

  // Restore cached map state (only on initial load to preserve refresh/back buttons)
  useEffect(() => {
    if (isInitialMountRef.current) {
      try {
        const cachedCenter = sessionStorage.getItem(`dashboard_map_center_${selectedRouter}`);
        const cachedZoom = sessionStorage.getItem(`dashboard_map_zoom_${selectedRouter}`);
        if (cachedCenter && cachedZoom) {
          hasFlownRef.current = true;
          userInteractedRef.current = true; // prevent auto-fit on load
          map.setView(JSON.parse(cachedCenter), Number(cachedZoom), { animate: false });
        }
      } catch(e) {}
      isInitialMountRef.current = false;
    }
  }, [map, selectedRouter]);

  // Save map state on move end
  useEffect(() => {
    if (!selectedRouter) return;
    const handleMoveEnd = () => {
      try {
        sessionStorage.setItem(`dashboard_map_center_${selectedRouter}`, JSON.stringify(map.getCenter()));
        sessionStorage.setItem(`dashboard_map_zoom_${selectedRouter}`, map.getZoom().toString());
      } catch(e) {}
    };
    map.on("moveend", handleMoveEnd);
    return () => map.off("moveend", handleMoveEnd);
  }, [map, selectedRouter]);

  useEffect(() => {
    // If the user has manually panned or zoomed, do not auto-fit anymore
    if (userInteractedRef.current) return;

    if (coordinates && coordinates.length > 0) {
      const validCoords = coordinates.filter(
        c => c && c.lat && c.lng && !isNaN(c.lat) && !isNaN(c.lng) && c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180
      );
      if (validCoords.length === 0) return;

      // Build a stable key from sorted positions rounded to 5 decimal places
      // This prevents realtime fields (rxBps, isOnline etc) from triggering re-fly
      const newKey = validCoords
        .map(c => `${Number(c.lat).toFixed(5)},${Number(c.lng).toFixed(5)}`)
        .sort()
        .join('|');

      // Only fly if the set of positions actually changed
      if (newKey === coordKeyRef.current) return;
      coordKeyRef.current = newKey;

      const bounds = L.latLngBounds(validCoords.map(c => [c.lat, c.lng]));
      // First time: delay slightly so user sees the initial view before zooming in
      const delay = hasFlownRef.current ? 0 : 600;
      hasFlownRef.current = true;
      const timer = setTimeout(() => {
        requestAnimationFrame(() => {
            map.flyToBounds(bounds.pad(0.1), {
              duration: 1.5,
              maxZoom: 16,
              easeLinearity: 0.25
            });
        });
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [coordinates, map, selectedRouter]);

  return null;
}

// Optimized connection lines to prevent re-rendering and lag
export const MemoizedPolyline = React.memo(({ coordinates, color, weight, dashArray, label, isPopupOpen, onClick, onPopupClose }) => {
  return (
    <Polyline 
      positions={coordinates}
      pathOptions={{ color, weight, opacity: 0.85, dashArray, lineCap: "round" }}
      eventHandlers={onClick ? { click: onClick } : undefined}
    >
      {isPopupOpen && (
        <Popup autoPan={false} eventHandlers={onPopupClose ? { remove: onPopupClose } : undefined}>
          <strong style={{ color }}>{label}</strong>
        </Popup>
      )}
    </Polyline>
  );
}, (prev, next) => {
  if (prev.color !== next.color ||
      prev.weight !== next.weight ||
      prev.dashArray !== next.dashArray ||
      prev.label !== next.label ||
      prev.isPopupOpen !== next.isPopupOpen ||
      prev.onClick !== next.onClick ||
      prev.onPopupClose !== next.onPopupClose) {
    return false;
  }
  if (prev.coordinates.length !== next.coordinates.length) return false;
  for (let i = 0; i < prev.coordinates.length; i++) {
    const p = prev.coordinates[i];
    const n = next.coordinates[i];
    if (Array.isArray(p) && Array.isArray(n)) {
      if (p[0] !== n[0] || p[1] !== n[1]) return false;
    } else if (p.lat !== n.lat || p.lng !== n.lng) {
      return false;
    }
  }
  return true;
});

// Optimized marker component to prevent rendering of markers whose positions and statuses have not changed.
export const MemoizedMarker = React.memo(({ position, icon, onClick, isOpen, renderPopup }) => {
  return (
    <Marker position={position} icon={icon} eventHandlers={onClick ? { click: onClick } : undefined}>
      {renderPopup()}
    </Marker>
  );
}, (prev, next) => {
  // If the popup is open, we always re-render to display live traffic/data updates
  if (next.isOpen) return false;
  if (prev.icon !== next.icon) return false;
  if (prev.isOpen !== next.isOpen) return false;
  if (prev.position[0] !== next.position[0] || prev.position[1] !== next.position[1]) return false;
  return true;
});
