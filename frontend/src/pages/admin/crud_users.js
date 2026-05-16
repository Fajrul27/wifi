import { useEffect, useState } from "react";
import api from "../../services/api";

export default function Technician() {
  const [data, setData] = useState([]);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const load = async () => {
    const res = await api.get("/admin/technicians");
    setData(res.data.data);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    await api.post("/admin/technicians", form);
    setForm({ username: "", email: "", password: "" });
    load();
  };

  const remove = async (id) => {
    await api.delete(`/admin/technicians/${id}`);
    load();
  };

  return (
    <div className="container mt-4">
      <h3>Technicians</h3>

      {/* FORM */}
      <form onSubmit={create} className="card p-3 mb-3">
        <input
          className="form-control mb-2"
          placeholder="Username"
          value={form.username}
          onChange={(e) =>
            setForm({ ...form, username: e.target.value })
          }
        />

        <input
          className="form-control mb-2"
          placeholder="Email"
          value={form.email}
          onChange={(e) =>
            setForm({ ...form, email: e.target.value })
          }
        />

        <input
          type="password"
          className="form-control mb-2"
          placeholder="Password"
          value={form.password}
          onChange={(e) =>
            setForm({ ...form, password: e.target.value })
          }
        />

        <button className="btn btn-primary">Create</button>
      </form>

      {/* TABLE */}
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {data.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => remove(u.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}