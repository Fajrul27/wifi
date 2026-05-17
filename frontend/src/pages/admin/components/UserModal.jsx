import React from "react";

export default function UserModal({ show, mode, form, saving, onChange, onSubmit, onClose }) {
  if (!show) return null;

  return (
    <div className="modal fade show d-block bg-dark bg-opacity-50" tabIndex="-1" onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          <div className="modal-header bg-light border-0 p-4 pb-3">
            <h5 className="modal-title fw-bold text-dark">
              {mode === "create" ? "Tambah Pengguna Baru" : "Edit Data Pengguna"}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={onSubmit}>
            <div className="modal-body p-4">
              <div className="mb-3">
                <label className="form-label fw-bold text-secondary small mb-1">Username</label>
                <input
                  type="text"
                  className="form-control form-control-lg bg-light border-0 px-3 py-2 rounded-3"
                  placeholder="Masukkan username pengguna"
                  value={form.username}
                  onChange={(e) => onChange({ ...form, username: e.target.value })}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold text-secondary small mb-1">Email Address</label>
                <input
                  type="email"
                  className="form-control form-control-lg bg-light border-0 px-3 py-2 rounded-3"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={(e) => onChange({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold text-secondary small mb-1">Peran (Role)</label>
                <select
                  className="form-select form-select-lg bg-light border-0 px-3 py-2 rounded-3 text-dark fw-medium"
                  value={form.role}
                  onChange={(e) => onChange({ ...form, role: e.target.value })}
                  required
                >
                  <option value="ADMIN">Super Admin (ADMIN)</option>
                  <option value="ADMIN_NOC">NOC Jaringan (ADMIN_NOC)</option>
                  <option value="TEKNISI">Teknisi Lapangan (TEKNISI)</option>
                  <option value="HELPDESK">Customer Service (HELPDESK)</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold text-secondary small mb-1">
                  {mode === "create" ? "Password" : "Ganti Password (Opsional)"}
                </label>
                <input
                  type="password"
                  className="form-control form-control-lg bg-light border-0 px-3 py-2 rounded-3"
                  placeholder={mode === "create" ? "Masukkan password" : "Kosongkan jika tidak diubah"}
                  value={form.password}
                  onChange={(e) => onChange({ ...form, password: e.target.value })}
                  required={mode === "create"}
                />
              </div>
            </div>
            <div className="modal-footer bg-light border-0 p-3 justify-content-end gap-2">
              <button type="button" className="btn btn-light px-4 py-2 fw-medium rounded-3 border" onClick={onClose}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary px-4 py-2 fw-bold rounded-3 shadow-sm d-flex align-items-center gap-2" disabled={saving}>
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    Menyimpan...
                  </>
                ) : (
                  "Simpan"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
