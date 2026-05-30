import React, { useEffect, useRef } from 'react';
import { useMap, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';

// Component to auto-fit map bounds to markers
export function FitMapBounds({ coordinates, selectedRouter }) {
  const map = useMap();
  const prevRouterRef = useRef(undefined);
  const userInteractedRef = useRef(false);
  
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

  // Restore cached map state
  useEffect(() => {
    try {
      const cachedCenter = sessionStorage.getItem(`dashboard_map_center_${selectedRouter}`);
      const cachedZoom = sessionStorage.getItem(`dashboard_map_zoom_${selectedRouter}`);
      if (cachedCenter && cachedZoom && !hasFlownRef.current) {
        hasFlownRef.current = true;
        userInteractedRef.current = true; // prevent auto-fit
        map.setView(JSON.parse(cachedCenter), Number(cachedZoom), { animate: false });
      }
    } catch(e) {}
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
  }, [coordinates, map]);
  
  return null;
}

// Optimized connection lines to prevent re-rendering and lag
export const MemoizedPolyline = React.memo(({ coordinates, color, weight, dashArray, label }) => {
  return (
    <Polyline 
      positions={coordinates}
      pathOptions={{ color, weight, opacity: 0.85, dashArray, lineCap: "round" }}
    >
      <Popup autoPan={false}><strong style={{ color }}>{label}</strong></Popup>
    </Polyline>
  );
}, (prev, next) => {
  if (prev.color !== next.color ||
      prev.weight !== next.weight ||
      prev.dashArray !== next.dashArray ||
      prev.label !== next.label) {
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
