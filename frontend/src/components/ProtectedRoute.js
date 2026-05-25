import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../api/client";

export default function ProtectedRoute({ children, role }) {
  const [user, setUser] = useState(undefined); // ✔ penting: undefined bukan null

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api.get("/auth/me");
        setUser(res.data.user);
      } catch (err) {
        setUser(null); // unauthorized
      }
    };

    checkAuth();
  }, []);

  // loading state
  if (user === undefined) {
    return (
      <div className="text-center mt-5">
        Loading...
      </div>
    );
  }

  // not logged in
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // role check
  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
}