import React from "react";

export default function UserTable({ data, loading, onEdit, onRemove }) {
  const getRoleBadge = (role) => {
    switch (role) {
      case "ADMIN":
        return <span className="badge bg-danger bg-opacity-10 text-danger px-3 py-1 rounded-pill fw-semibold small">Super Admin</span>;
      case "ADMIN_NOC":
        return <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-1 rounded-pill fw-semibold small">NOC Jaringan</span>;
      case "HELPDESK":
        return <span className="badge bg-warning bg-opacity-10 text-dark px-3 py-1 rounded-pill fw-semibold small">Customer Service</span>;
      default:
        return <span className="badge bg-info bg-opacity-10 text-info px-3 py-1 rounded-pill fw-semibold small">Teknisi Lapangan</span>;
    }
  };

  return (
    <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light text-secondary small text-uppercase fw-bold">
            <tr>
              <th className="py-3 px-4">Pengguna</th>
              <th className="py-3">Email</th>
              <th className="py-3">Peran (Role)</th>
              <th className="py-3">Tanggal Terdaftar</th>
              <th className="py-3 px-4 text-end">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center py-5">
                  <div className="spinner-border text-primary mb-2" role="status"></div>
                  <div className="text-muted small">Memuat data pengguna...</div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-5 text-muted">
                  <i className="bi bi-people fs-1 d-block mb-2 opacity-50"></i>
                  Tidak ada data pengguna yang ditemukan.
                </td>
              </tr>
            ) : (
              data.map((u) => (
                <tr key={u.id} style={{ transition: "background 0.2s" }}>
                  <td className="py-3 px-4">
                    <div className="d-flex align-items-center gap-3">
                      <div className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center fw-bold" style={{ width: "42px", height: "42px", fontSize: "1.1rem" }}>
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="fw-bold text-dark">{u.username}</div>
                    </div>
                  </td>
                  <td className="py-3 text-secondary">{u.email}</td>
                  <td className="py-3">
                    {getRoleBadge(u.role)}
                  </td>
                  <td className="py-3 text-secondary small">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : "-"}
                  </td>
                  <td className="py-3 px-4 text-end">
                    <div className="d-flex gap-2 justify-content-end">
                      <button
                        className="btn btn-light btn-sm px-3 py-1 rounded-3 d-flex align-items-center gap-1 text-primary fw-medium border"
                        onClick={() => onEdit(u)}
                      >
                        <i className="bi bi-pencil-square"></i> Edit
                      </button>
                      <button
                        className="btn btn-light btn-sm px-3 py-1 rounded-3 d-flex align-items-center gap-1 text-danger fw-medium border border-danger-subtle hover-danger"
                        onClick={() => onRemove(u.id, u.username)}
                      >
                        <i className="bi bi-trash"></i> Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
