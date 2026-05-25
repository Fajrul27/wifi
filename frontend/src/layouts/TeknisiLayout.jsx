import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import menu from "../config/menu";
import { FaBars } from "react-icons/fa";
import LogoutConfirmModal from "../components/LogoutConfirmModal";

export default function TeknisiLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [openMenus, setOpenMenus] = useState({});
  const [mobileOpen, setMobileOpen] = useState(false);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loadingLogout, setLoadingLogout] = useState(false);

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
     LOGOUT
  ========================= */
  const handleLogout = async () => {
    try {
      setLoadingLogout(true);

      await api.post("/auth/logout");

      navigate("/");
    } catch (err) {
      console.log(err);
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
        <h5 className="mb-0">Teknisi Panel</h5>
        <button onClick={() => setMobileOpen(true)} className="btn btn-dark">
          <FaBars />
        </button>
      </div>

      {/* SIDEBAR */}
      <div className={`sidebar ${mobileOpen ? "open" : ""}`}>

        {/* LOGO */}
        <div className="logo px-3 py-3">
          <div className="logo-box">T</div>

          <div>
            <div className="fw-bold">Teknisi Panel</div>
            <div className="user-email-top">
              {user?.email || "loading..."}
            </div>
          </div>
        </div>

        {/* MENU */}
        <div className="px-3">
          {renderMenu(menu.TEKNISI)}
        </div>
      </div>

      {/* OVERLAY MOBILE */}
      {mobileOpen && (
        <div className="overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* CONTENT */}
      <div className="content">{children}</div>

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
          background: #f4f6f9;
        }

        .sidebar {
          width: 260px;
          background: #0f172a;
          color: white;
          display: flex;
          flex-direction: column;
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
          background: #22c55e;
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
        }

        .menu-item:hover {
          background: rgba(255,255,255,0.08);
        }

        .menu-item:disabled {
          opacity: 0.6;
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
          color: #22c55e !important;
        }

        .content {
          flex: 1;
          padding: 20px;
        }

        .topbar {
          background: #0f172a;
          color: white;
        }

        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
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
        }
      `}</style>
    </div>
  );
}