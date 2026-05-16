// import { useEffect, useRef, useState } from "react";

// export default function useMikrotikStream(routerId) {
//   const wsRef = useRef(null);
//   const [metrics, setMetrics] = useState([]);
//   const [traffic, setTraffic] = useState([]);
//   const [status, setStatus] = useState(false);

//   useEffect(() => {
//     const ws = new WebSocket("ws://localhost:8080");
//     wsRef.current = ws;

//     ws.onmessage = (event) => {
//       const msg = JSON.parse(event.data);

//       if (msg.routerId !== routerId) return;

//       if (msg.type === "metrics") {
//         setMetrics((prev) => [...prev.slice(-19), msg.data]);
//       }

//       if (msg.type === "traffic") {
//         setTraffic((prev) => [...prev.slice(-19), msg.data]);
//       }
//     };

//     ws.onopen = () => {
//       console.log("WebSocket connected");
//     };

//     ws.onclose = () => {
//       console.log("WebSocket closed");
//     };

//     return () => ws.close();
//   }, [routerId]);

//   return { metrics, traffic, status };
// }