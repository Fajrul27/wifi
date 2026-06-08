// src/config/routes.js
import Login from "../pages/auth/Login";

// admin
import AdminDashboard from "../pages/admin/AdminDashboard";
import Technician from "../pages/admin/crud_users";
import Profile from "../pages/admin/Profile";
import RouterList from "../pages/router/RouterList";
import PPPoE from "../pages/router/PppoePage";
import maps from "../pages/ftth/maps";
import ftth from "../pages/ftth/FtthTopologyManager";
import bandwidth from "../pages/router/bandwidth";

// teknisi
import TechnicianDashboard from "../pages/maintenance/TechnicianDashboard";
import mapss from "../pages/maintenance/maps";
import AdminLayout from "../layouts/AdminLayout";
import TeknisiLayout from "../layouts/TeknisiLayout";

const adminRole = "ADMIN";
const teknisiRole = "TEKNISI";

const routes = [
  {
    path: "/",
    element: Login,
  },

  {
    path: "/admin",
    layout: AdminLayout,
    element: AdminDashboard,
    role: adminRole,
  },
  {
    path: "/admin/technicians",
    layout: AdminLayout,
    element: Technician,
    role: adminRole,
  },
  {
    path: "/admin/profile",
    layout: AdminLayout,
    element: Profile,
    role: adminRole,
  },
  {
    path: "/admin/routers",
    layout: AdminLayout,
    element: RouterList,
    role: adminRole,
  },
  {
    path: "/admin/ppp",
    layout: AdminLayout,
    element: PPPoE,
    role: adminRole,
  },
  {
    path: "/admin/maps",
    layout: AdminLayout,
    element: maps,
    role: adminRole,
  },
  {
    path: "/admin/ftth",
    layout: AdminLayout,
    element: ftth,
    role: adminRole,
  },
  {
    path: "/admin/pppoe_profiles",
    layout: AdminLayout,
    element: bandwidth,
    role: adminRole,
  },

  {
    path: "/teknisi",
    layout: TeknisiLayout,
    element: TechnicianDashboard,
    role: teknisiRole,
  },
  {
    path: "/teknisi/maps",
    layout: TeknisiLayout,
    element: mapss,
    role: teknisiRole,
  },
  {
    path: "/teknisi/pppoe-session",
    layout: TeknisiLayout,
    element: PPPoE,
    role: teknisiRole,
  },
  {
    path: "/teknisi/profile",
    layout: TeknisiLayout,
    element: Profile,
    role: teknisiRole,
  },
];

export default routes;
