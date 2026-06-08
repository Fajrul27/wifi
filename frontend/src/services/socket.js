import { io } from "socket.io-client";

const socketUrl = process.env.REACT_APP_SOCKET_URL
  || ((process.env.NODE_ENV === "production" || window.location.hostname !== "localhost")
    ? window.location.origin
    : "http://localhost:5000");

export const socket = io(socketUrl, { autoConnect: false });
