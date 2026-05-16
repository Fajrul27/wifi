import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import menu from "../config/menu";
import { FaBars } from "react-icons/fa";
import LogoutConfirmModal from "../components/LogoutConfirmModal";

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [openMenus, setOpenMenus] = useState({});
  const [mobileOpen, setMobileOpen] = useState(false);

  // logout state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loadingLogout, setLoadingLogout] = useState(false);

  /* =========================
     DISABLE BODY SCROLL
  ========================= */
  useEffect(() => {
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  /* =========================
     FETCH USER
  ========================= */
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get("/auth/me");
        if (res.data?.user) setUser(res.data.user);
      } catch (err) {
        console.log(err);
      }
    };

    fetchUser();
  }, []);

  const isActive = (path) => location.pathname === path;

  /* =========================
     LOGOUT ACTION
  ========================= */
  const handleLogout = async () => {
    try {
      setLoadingLogout(true);
      await api.post("/auth/logout");
      navigate("/");
    } catch (err) {
      console.log("Logout error:", err);
    } finally {
      setLoadingLogout(false);
      setShowLogoutConfirm(false);
    }
  };

  /* =========================
     MENU HANDLER
  ========================= */
  const handleClick = (item) => {
    if (item.isLogout) {
      setShowLogoutConfirm(true);
      return;
    }

    if (item.children) {
      setOpenMenus((prev) => ({
        ...prev,
        [item.name]: !prev[item.name],
      }));
      return;
    }

    if (item.path) {
      navigate(item.path);
      setMobileOpen(false);
    }
  };

  /* =========================
     RENDER MENU
  ========================= */
  const renderMenu = (items) =>
    items.map((item, i) => {
      const Icon = item.icon;
      const open = openMenus[item.name];

      return (
        <div key={i} className="mb-1">

          <button
            onClick={() => handleClick(item)}
            className="menu-item w-100 d-flex align-items-center px-3 py-2 rounded-3 border-0"
            disabled={item.isLogout && loadingLogout}
          >
            {Icon && <Icon />}
            <span className="ms-2">
              {item.isLogout && loadingLogout ? "Logging out..." : item.name}
            </span>
          </button>

          {item.children && open && (
            <div className="ms-4 mt-1">
              {item.children.map((c, j) => (
                <button
                  key={j}
                  onClick={() => {
                    navigate(c.path);
                    setMobileOpen(false);
                  }}
                  className={`submenu w-100 text-start px-3 py-2 rounded-3 border-0
                    ${isActive(c.path) ? "active-sub" : ""}
                  `}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    });

  return (
    <div className="layout">

      {/* TOPBAR MOBILE */}
      <div className="topbar d-md-none d-flex justify-content-between align-items-center px-3 py-2">
        <h5 className="mb-0">Dashboard</h5>
        <button onClick={() => setMobileOpen(true)} className="btn btn-dark">
          <FaBars />
        </button>
      </div>

      {/* SIDEBAR */}
      <div className={`sidebar ${mobileOpen ? "open" : ""}`}>

        {/* LOGO */}
        <div className="logo px-3 py-3">
          <div className="logo-box">S</div>

          <div>
            <div className="fw-bold">Admin Panel</div>
            <div className="user-email-top">
              {user?.email || "loading..."}
            </div>
          </div>
        </div>

        {/* MENU */}
        <div className="px-3 sidebar-menu">
          {renderMenu(menu.ADMIN)}
        </div>
      </div>

      {/* OVERLAY MOBILE */}
      {mobileOpen && (
        <div className="overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* CONTENT */}
      <div className="content">
        {children}
      </div>

      {/* LOGOUT MODAL */}
      <LogoutConfirmModal
        open={showLogoutConfirm}
        loading={loadingLogout}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
      />

      {/* STYLE */}
      <style>{`
        .layout {
          display: flex;
          height: 100vh;
          overflow: hidden;
          background: #f4f6f9;
        }

        .sidebar {
          width: 260px;
          background: #0b1220;
          color: white;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }

        .sidebar-menu {
          overflow-y: auto;
          flex: 1;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .logo-box {
          width: 36px;
          height: 36px;
          background: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          font-weight: bold;
        }

        .user-email-top {
          font-size: 12px;
          color: #94a3b8;
        }

        .menu-item {
          background: transparent;
          color: #cbd5e1;
          margin-bottom: 5px;
          cursor: pointer;
          transition: 0.2s;
        }

        .menu-item:hover {
          background: rgba(255,255,255,0.08);
        }

        .menu-item:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .submenu {
          background: transparent;
          color: #94a3b8;
          font-size: 14px;
        }

        .submenu:hover {
          color: #fff;
        }

        .active-sub {
          color: #60a5fa !important;
        }

        .content {
          flex: 1;
          height: 100vh;
          overflow-y: auto;
          padding: 20px;
        }

        .topbar {
          background: #0b1220;
          color: white;
        }

        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 10;
        }

        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            left: -260px;
            top: 0;
            bottom: 0;
            z-index: 20;
            transition: 0.3s;
          }

          .sidebar.open {
            left: 0;
          }

          .content {
            width: 100%;
          }
        }

        /* OPTIONAL: smoother scroll */
        .content::-webkit-scrollbar {
          width: 6px;
        }

        .content::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}