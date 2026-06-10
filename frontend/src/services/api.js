import axios from "axios";

const getApiBaseURL = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  if (process.env.NODE_ENV === "production" || window.location.hostname !== "localhost") {
    return "/api";
  }

  return "http://localhost:3000/api";
};

const api = axios.create({
  // If we are on a real domain (not localhost), always use relative path /api
  // This prevents browsers from blocking requests due to mixed content or Local Network Access rules
  baseURL: getApiBaseURL(),
   withCredentials: true,
  timeout: 15000, // 🔥 penting biar tidak hanging request
  headers: {
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Expires": "0",
  }
});

/* =========================
   REDIRECT LOCK (FIXED)
========================= */
let isRedirecting = false;

/* =========================
   REQUEST INTERCEPTOR
========================= */
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/* =========================
   RESPONSE INTERCEPTOR
========================= */
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;

    // 🔥 handle unauthorized
    if (status === 401) {
      handleLogoutRedirect();
    }

    // 🔥 handle server error (optional logging)
    if (status >= 500) {
      console.error("Server error:", err.response?.data);
    }

    return Promise.reject(err);
  }
);

/* =========================
   SAFE REDIRECT HANDLER
========================= */
function handleLogoutRedirect() {
  if (isRedirecting) return;
  if (window.location.pathname === "/") return;

  isRedirecting = true;

  setTimeout(() => {
    // optional: clear local state
    localStorage.removeItem("user");

    window.location.href = "/";
  }, 150);
}

export default api;
