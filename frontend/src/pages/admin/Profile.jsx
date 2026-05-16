import { useEffect, useState } from "react";
import api from "../../services/api";

export default function Profile() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/auth/me");
        setUser(res.data.user);
      } catch (err) {
        console.log(err);
      }
    };

    fetchProfile();
  }, []);

  return (
    <div className="container py-4">

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4">

          <h4 className="mb-4">Profile</h4>

          <div className="row">

            {/* LEFT */}
            <div className="col-md-4 text-center border-end">
              <div
                className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center mx-auto"
                style={{ width: 80, height: 80, fontSize: 30 }}
              >
                {user?.username?.charAt(0).toUpperCase()}
              </div>

              <h5 className="mt-3">{user?.username}</h5>
              <p className="text-muted">{user?.role}</p>
            </div>

            {/* RIGHT */}
            <div className="col-md-8">

              <div className="mb-3">
                <label className="form-label">Username</label>
                <input
                  className="form-control"
                  value={user?.username || ""}
                  disabled
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Email</label>
                <input
                  className="form-control"
                  value={user?.email || ""}
                  disabled
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Role</label>
                <input
                  className="form-control"
                  value={user?.role || ""}
                  disabled
                />
              </div>

            </div>

          </div>

        </div>
      </div>

    </div>
  );
}