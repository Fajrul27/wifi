// src/config/routes.js
import Login from "../pages/auth/Login";

import AdminDashboard from "../pages/admin/AdminDashboard";
import Technician from "../pages/admin/crud_users";
import Profile from "../pages/admin/Profile";
import RouterList from "../pages/router/RouterList"
import PPPoE from "../pages/router/PppoePage"
import maps from "../pages/ftth/maps"
import ftth from "../pages/ftth/FtthTopologyManager"
import SpeedProfile from "../pages/SpeedProfilePage"


import TechnicianDashboard from "../pages/maintenance/TechnicianDashboard";
import mapss from "../pages/maintenance/maps"
import AdminLayout from "../layouts/AdminLayout";
import TeknisiLayout from "../layouts/TeknisiLayout";

const routes = [
  {
    path: "/",
    element: Login,
  },

  // ADMIN
  {
    path: "/admin",
    layout: AdminLayout,
    element: AdminDashboard,
  },

  // 🔥 ROUTER DETAIL WAJIB INI
  {
    path: "/admin",
    layout: AdminLayout,
    element: AdminDashboard,
  },

  {
    path: "/admin/technicians",
    layout: AdminLayout,
    element: Technician,
  },

  {
    path: "/admin/profile",
    layout: AdminLayout,
    element: Profile,
  },
  {
  path: "/admin/routers",
  layout: AdminLayout,
  element: RouterList,
},
  {
  path: "/admin/ppp",
  layout: AdminLayout,
  element: PPPoE,
},

  {
  path: "/admin/maps",
  layout: AdminLayout,
  element: maps,
},
  {
  path: "/admin/ftth",
  layout: AdminLayout,
  element: ftth,
},
  {
  path: "/admin/speed-profiles",
  layout: AdminLayout,
  element: SpeedProfile,
},

  // TEKNISI
  {
    path: "/teknisi",
    layout: TeknisiLayout,
    element: TechnicianDashboard,
  },
   {
    path: "/teknisi/maps",
    layout: TeknisiLayout,
    element: mapss,
  },
  {
    path: "/teknisi/profile",
    layout: TeknisiLayout,
    element: Profile,
  },
];

export default routes;