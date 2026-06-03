import { io } from "socket.io-client";

// If we are on a real domain (not localhost), always use origin
// This prevents browsers from blocking WebSocket due to Local Network Access rules
const socketUrl = (process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost')
  ? window.location.origin
  : "http://localhost:3000";

export const socket = io(socketUrl);