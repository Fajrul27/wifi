import { io } from "socket.io-client";

// Use the current host in production (Nginx proxies it), or localhost:3000 for local dev
export const socket = io(process.env.NODE_ENV === 'production' ? window.location.origin : "http://localhost:3000");