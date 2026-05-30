import axios from "axios";

const api = axios.create({
 baseURL: "http://localhost:3000/api",
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

  isRedirecting = true;

  setTimeout(() => {
    // optional: clear local state
    localStorage.removeItem("user");

    window.location.href = "/";
  }, 150);
}

export default api;