import { FaHome, FaUsers, FaCog, FaSignOutAlt } from "react-icons/fa";

const menu = {
  ADMIN: [
    { name: "Dashboard", path: "/admin", icon: FaHome },

    {
      name: "Management",
      icon: FaUsers,
      children: [
        { name: "PPPoE", path: "/admin/ppp" },        
        { name: "FTTH", path: "/admin/ftth" },
        { name: "Routers", path: "/admin/routers" },
        { name: "Profil Kecepatan", path: "/admin/speed-profiles" },
      ],
    },

    {
      name: "Settings",
      icon: FaCog,
      children: [
        { name: "Profile", path: "/admin/profile" },
        { name: "Users", path: "/admin/technicians" },        
      ],
    },

    {
      name: "Logout",
      path: "logout",
      icon: FaSignOutAlt,
      isLogout: true,
    },
  ],

  TEKNISI: [
    { name: "Dashboard", path: "/teknisi", icon: FaHome },
    { name: "maps", path: "/teknisi/maps", icon: FaHome },
    { name: "Logout", path: "logout", icon: FaSignOutAlt, isLogout: true },
    { name: "Profile", path: "/teknisi/profile" },
    

  ],
};

export default menu;