const pLimit = require("p-limit");

const limit = pLimit(5);
const routeCache = new Map();

/**
 * Fetches road-snapped route coordinates between start and end coordinates using OSRM.
 * Results are cached in memory to ensure instant retrieval on subsequent calls.
 */
async function getRoadRoute(startLat, startLng, endLat, endLng) {
  const cacheKey = `${startLat},${startLng};${endLat},${endLng}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }

  // Use p-limit to throttle OSRM API calls to max 5 concurrent requests
  return limit(async () => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates) {
        const roadCoords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [
          Number(lat),
          Number(lng),
        ]);
        
        // Ensure the line connects precisely from the source node to the destination node
        const coords = [
          [Number(startLat), Number(startLng)],
          ...roadCoords,
          [Number(endLat), Number(endLng)]
        ];
        
        routeCache.set(cacheKey, coords);
        return coords;
      }
    } catch (err) {
      console.error("OSRM Routing Error:", err.message);
    }

    // Fallback to straight line if API fails or is offline
    const fallback = [
      [startLat, startLng],
      [endLat, endLng],
    ];
    return fallback;
  });
}

module.exports = {
  getRoadRoute,
};
