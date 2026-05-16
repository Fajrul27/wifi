import { useEffect, useState } from "react";
import api from "../services/api";

// ─── Format rateLimit untuk display ─────────────────────────────────────────
function parseRate(r) {
  if (!r) return { up: "?", down: "?" };
  // "10M/10M" atau "10240k/10240k"
  const parts = r.split("/");
  if (parts.length === 2) return { up: parts[0], down: parts[1] };
  return { up: r, down: r };
}

const SPEED_PRESETS = [
  "Loss Kecepatan (Tanpa Limit)",
  "1M/1M", "2M/2M", "3M/3M", "5M/5M", "8M/8M",
  "10M/10M", "15M/15M", "20M/20M", "25M/25M",
  "30M/30M", "50M/50M", "100M/100M",
];

const EMPTY_FORM = { name: "", rateLimit: "", description: "", isActive: true };

export default function SpeedProfilePage() {
  const [profiles, setProfiles]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [editId, setEditId]         = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [customRate, setCustomRate] = useState(false);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const res = await api.get("/speed-profiles");
      setProfiles(res.data.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadProfiles(); }, []);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setError("");
    setCustomRate(false);
    setModal(true);
  };

  const openEdit = (p) => {
    setForm({ name: p.name, rateLimit: p.rateLimit, description: p.description || "", isActive: p.isActive });
    setEditId(p.id);
    setError("");
    setCustomRate(!SPEED_PRESETS.includes(p.rateLimit));
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Nama Profile wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      if (editId) {
        await api.put(`/speed-profiles/${editId}`, form);
      } else {
        await api.post("/speed-profiles", form);
      }
      setModal(false);
      loadProfiles();
    } catch (err) {
      setError(err.response?.data?.message || "Gagal menyimpan profile");
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/speed-profiles/${id}`);
      setDeleteConfirm(null);
      loadProfiles();
    } catch (err) {
      alert(err.response?.data?.message || "Gagal menghapus");
    }
  };

  const handleRatePreset = (val) => {
    if (val === "__custom__") { setCustomRate(true); setForm(f => ({ ...f, rateLimit: "" })); }
    else if (val === "LOSS") { setCustomRate(false); setForm(f => ({ ...f, rateLimit: "" })); }
    else { setCustomRate(false); setForm(f => ({ ...f, rateLimit: val })); }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="container-fluid py-4 px-lg-4" style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
      {/* Header Section */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 pb-2 border-bottom border-secondary-subtle">
        <div className="mb-3 mb-md-0">
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill bg-primary bg-opacity-10 text-primary fw-semibold small mb-2">
            <i className="bi bi-sliders"></i> Manajemen Bandwidth
          </div>
          <h3 className="fw-bold text-dark mb-1">Profil Kecepatan</h3>
          <p className="text-muted small mb-0">
            Atur dan alokasikan paket kecepatan internet (*rate limit*) untuk pelanggan PPPoE secara terpusat.
          </p>
        </div>
        <button className="btn btn-primary px-4 py-2 rounded-3 shadow-sm d-flex align-items-center gap-2 fw-medium" onClick={openAdd}>
          <i className="bi bi-plus-lg fs-6"></i> Tambah Profil Baru
        </button>
      </div>

      {/* Stats Overview Cards */}
      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <div className="card border border-secondary-subtle rounded-4 bg-white shadow-sm h-100 p-3 hover-shadow transition-all">
            <div className="card-body d-flex align-items-center justify-content-between p-1">
              <div>
                <p className="text-muted small fw-semibold text-uppercase mb-1 tracking-wider">Total Profil</p>
                <h2 className="fw-bold text-dark mb-0">{profiles.length}</h2>
              </div>
              <div className="bg-primary bg-opacity-10 text-primary p-3 rounded-4 d-flex align-items-center justify-content-center" style={{ width: "60px", height: "60px" }}>
                <i className="bi bi-collection fs-3"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card border border-secondary-subtle rounded-4 bg-white shadow-sm h-100 p-3 hover-shadow transition-all">
            <div className="card-body d-flex align-items-center justify-content-between p-1">
              <div>
                <p className="text-muted small fw-semibold text-uppercase mb-1 tracking-wider">Profil Aktif</p>
                <h2 className="fw-bold text-success mb-0">{profiles.filter(p => p.isActive).length}</h2>
              </div>
              <div className="bg-success bg-opacity-10 text-success p-3 rounded-4 d-flex align-items-center justify-content-center" style={{ width: "60px", height: "60px" }}>
                <i className="bi bi-check-circle fs-3"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card border border-secondary-subtle rounded-4 bg-white shadow-sm h-100 p-3 hover-shadow transition-all">
            <div className="card-body d-flex align-items-center justify-content-between p-1">
              <div>
                <p className="text-muted small fw-semibold text-uppercase mb-1 tracking-wider">Profil Nonaktif</p>
                <h2 className="fw-bold text-secondary mb-0">{profiles.filter(p => !p.isActive).length}</h2>
              </div>
              <div className="bg-secondary bg-opacity-10 text-secondary p-3 rounded-4 d-flex align-items-center justify-content-center" style={{ width: "60px", height: "60px" }}>
                <i className="bi bi-pause-circle fs-3"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="card border border-secondary-subtle rounded-4 shadow-sm bg-white overflow-hidden mb-5">
        <div className="card-header bg-white py-3 px-4 border-bottom border-secondary-subtle d-flex align-items-center justify-content-between">
          <h6 className="mb-0 fw-bold text-dark"><i className="bi bi-table me-2 text-primary"></i>Daftar Profil Kecepatan</h6>
          <span className="badge bg-light text-secondary border border-secondary-subtle px-3 py-1 rounded-pill small fw-medium">
            Diperbarui secara realtime
          </span>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5 my-5">
              <div className="spinner-border text-primary mb-3" role="status" style={{ width: "3rem", height: "3rem" }}></div>
              <div className="text-muted fw-medium small">Memuat data profil kecepatan...</div>
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-5 my-5 text-muted">
              <div className="bg-light rounded-circle p-4 d-inline-block mb-3 border border-secondary-subtle">
                <i className="bi bi-inbox fs-1 text-secondary"></i>
              </div>
              <h5 className="fw-bold text-dark">Belum Ada Profil Kecepatan</h5>
              <p className="text-muted small mb-4">Mulai kelola alokasi bandwidth dengan menambahkan profil pertama Anda.</p>
              <button className="btn btn-primary px-4 py-2 rounded-3 shadow-sm fw-medium" onClick={openAdd}>
                <i className="bi bi-plus-lg me-2"></i> Tambah Profil
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="bg-light text-secondary text-uppercase fs-7 fw-bold" style={{ fontSize: "0.75rem", letterSpacing: "0.5px" }}>
                  <tr>
                    <th className="py-3 px-4" style={{ width: "60px" }}>#</th>
                    <th className="py-3">Nama Paket</th>
                    <th className="py-3">Upload Limit</th>
                    <th className="py-3">Download Limit</th>
                    <th className="py-3">Format Mikrotik</th>
                    <th className="py-3">Keterangan</th>
                    <th className="py-3">Status</th>
                    <th className="py-3 px-4 text-end" style={{ width: "140px" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p, i) => {
                    const { up, down } = parseRate(p.rateLimit);
                    return (
                      <tr key={p.id} className="border-bottom border-secondary-subtle transition-all">
                        <td className="px-4 text-secondary fw-medium small">{i + 1}</td>
                        <td>
                          <div className="fw-bold text-dark fs-6">{p.name}</div>
                        </td>
                        <td>
                          <span className="badge bg-success bg-opacity-10 text-success border border-success-subtle rounded-pill px-3 py-1 fw-semibold d-inline-flex align-items-center gap-1">
                            <i className="bi bi-arrow-up-short fs-6"></i>{up}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle rounded-pill px-3 py-1 fw-semibold d-inline-flex align-items-center gap-1">
                            <i className="bi bi-arrow-down-short fs-6"></i>{down}
                          </span>
                        </td>
                        <td>
                          {p.rateLimit ? (
                            <code className="text-dark fw-bold bg-light px-2 py-1 rounded-3 border border-secondary-subtle small">{p.rateLimit}</code>
                          ) : (
                            <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary-subtle rounded-pill px-3 py-1 fw-medium">Loss (Tanpa Limit)</span>
                          )}
                        </td>
                        <td>
                          <span className="text-muted small">{p.description || "—"}</span>
                        </td>
                        <td>
                          {p.isActive ? (
                            <span className="badge bg-success bg-opacity-10 text-success border border-success-subtle rounded-pill px-3 py-1 fw-semibold d-inline-flex align-items-center gap-1 small">
                              <span className="p-1 bg-success rounded-circle"></span> Aktif
                            </span>
                          ) : (
                            <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary-subtle rounded-pill px-3 py-1 fw-semibold d-inline-flex align-items-center gap-1 small">
                              <span className="p-1 bg-secondary rounded-circle"></span> Nonaktif
                            </span>
                          )}
                        </td>
                        <td className="px-4 text-end">
                          <button
                            className="btn btn-sm btn-light text-primary hover-primary border border-secondary-subtle rounded-3 me-2 py-1 px-2 shadow-sm transition-all"
                            onClick={() => openEdit(p)}
                            title="Edit Profil"
                          >
                            <i className="bi bi-pencil fw-bold"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-light text-danger hover-danger border border-secondary-subtle rounded-3 py-1 px-2 shadow-sm transition-all"
                            onClick={() => setDeleteConfirm(p)}
                            title="Hapus Profil"
                          >
                            <i className="bi bi-trash fw-bold"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ─── MODAL ADD/EDIT (Minimalist Modern Glassmorphism Touch) ──────────────────────────────────────────────── */}
      {modal && (
        <div
          className="modal fade show d-block"
          style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 1050 }}
          onClick={() => setModal(false)}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white">
              <form onSubmit={handleSubmit}>
                <div className="modal-header bg-light py-3 px-4 border-bottom border-secondary-subtle d-flex align-items-center justify-content-between">
                  <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2 fs-5">
                    <div className="bg-primary bg-opacity-10 text-primary p-2 rounded-3 d-flex align-items-center justify-content-center">
                      <i className={`bi bi-${editId ? 'pencil-square' : 'plus-lg'}`}></i>
                    </div>
                    {editId ? "Edit Profil Kecepatan" : "Tambah Profil Kecepatan Baru"}
                  </h5>
                  <button type="button" className="btn-close bg-secondary bg-opacity-10 p-2 rounded-circle" onClick={() => setModal(false)}></button>
                </div>

                <div className="modal-body p-4">
                  {error && (
                    <div className="alert alert-danger py-2 px-3 rounded-3 small fw-medium d-flex align-items-center gap-2 mb-4 border border-danger-subtle shadow-sm">
                      <i className="bi bi-exclamation-triangle-fill text-danger fs-5"></i>
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="row g-4">
                    <div className="col-md-12">
                      <label className="form-label small fw-bold text-secondary mb-2">
                        NAMA PROFIT / PAKET <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6"
                        placeholder="contoh: 10 Mbps, Paket VIP Keluarga, Gaming 50M"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        required
                      />
                      <div className="form-text small text-muted mt-1">Nama ini akan muncul di pilihan dropdown saat mendaftarkan pelanggan PPPoE.</div>
                    </div>

                    <div className="col-md-12">
                      <label className="form-label small fw-bold text-secondary mb-2 d-flex align-items-center justify-content-between">
                        <span>PILIHAN PRESET KECEPATAN <span className="text-danger">*</span></span>
                        <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2 py-1 fw-medium small">Otomatis Terformat</span>
                      </label>
                      <select
                        className="form-select form-select-lg rounded-3 border-secondary-subtle fs-6 mb-3 shadow-none"
                        value={customRate ? "__custom__" : (form.rateLimit === "" && form.name !== "" ? "LOSS" : SPEED_PRESETS.includes(form.rateLimit) ? form.rateLimit : (form.rateLimit ? "__custom__" : ""))}
                        onChange={e => handleRatePreset(e.target.value)}
                      >
                        <option value="">— Pilih Preset Kecepatan —</option>
                        <option value="LOSS">⚡ Loss Kecepatan (Tanpa Limit / Full Bandwidth)</option>
                        {SPEED_PRESETS.filter(s => s !== "Loss Kecepatan (Tanpa Limit)").map(s => (
                          <option key={s} value={s}>🚀 {s.split("/")[0]} Upload / {s.split("/")[1]} Download</option>
                        ))}
                        <option value="__custom__">✏️ Kustomisasi Manual (Input Bebas)</option>
                      </select>

                      {customRate && (
                        <div className="p-4 bg-light rounded-4 border border-secondary-subtle mb-3 animation-fade-in">
                          <h6 className="fw-bold text-dark mb-3 small text-uppercase tracking-wider"><i className="bi bi-sliders me-2 text-primary"></i>Konfigurasi Bandwidth Kustom</h6>
                          <div className="row g-3">
                            <div className="col-md-6">
                              <label className="form-label small fw-semibold text-secondary mb-1">Limit Upload</label>
                              <div className="input-group input-group-lg rounded-3 shadow-sm overflow-hidden">
                                <span className="input-group-text bg-white border-secondary-subtle text-success fw-bold"><i className="bi bi-arrow-up-short fs-4"></i></span>
                                <input
                                  type="text"
                                  className="form-control border-secondary-subtle fs-6"
                                  placeholder="contoh: 10M atau 5120k"
                                  value={form.rateLimit.split("/")[0] || ""}
                                  onChange={e => {
                                    const down = form.rateLimit.split("/")[1] || "";
                                    setForm(f => ({ ...f, rateLimit: `${e.target.value}/${down}` }));
                                  }}
                                />
                              </div>
                            </div>
                            <div className="col-md-6">
                              <label className="form-label small fw-semibold text-secondary mb-1">Limit Download</label>
                              <div className="input-group input-group-lg rounded-3 shadow-sm overflow-hidden">
                                <span className="input-group-text bg-white border-secondary-subtle text-primary fw-bold"><i className="bi bi-arrow-down-short fs-4"></i></span>
                                <input
                                  type="text"
                                  className="form-control border-secondary-subtle fs-6"
                                  placeholder="contoh: 10M atau 10240k"
                                  value={form.rateLimit.split("/")[1] || ""}
                                  onChange={e => {
                                    const up = form.rateLimit.split("/")[0] || "";
                                    setForm(f => ({ ...f, rateLimit: `${up}/${e.target.value}` }));
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="form-text small text-muted mt-2">
                            <i className="bi bi-info-circle me-1"></i> Format Mikrotik: gunakan akhiran <strong>M</strong> untuk Megabits (contoh: 20M) atau <strong>k</strong> untuk Kilobits (contoh: 2048k).
                          </div>
                        </div>
                      )}

                      {form.rateLimit && form.rateLimit !== "LOSS" && (
                        <div className="d-flex flex-wrap align-items-center gap-2 p-3 bg-white border border-secondary-subtle rounded-3 shadow-sm">
                          <span className="small fw-bold text-muted me-2">PREVIEW ANTREAN MIKROTIK:</span>
                          <span className="badge bg-success bg-opacity-10 text-success border border-success-subtle rounded-pill px-3 py-1 fw-semibold d-inline-flex align-items-center gap-1">
                            <i className="bi bi-arrow-up-short fs-6"></i> Upload: {form.rateLimit.split("/")[0] || "?"}
                          </span>
                          <span className="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle rounded-pill px-3 py-1 fw-semibold d-inline-flex align-items-center gap-1">
                            <i className="bi bi-arrow-down-short fs-6"></i> Download: {form.rateLimit.split("/")[1] || "?"}
                          </span>
                        </div>
                      )}
                      {form.rateLimit === "" && form.name !== "" && (
                        <div className="d-flex align-items-center gap-2 p-3 bg-white border border-secondary-subtle rounded-3 shadow-sm">
                          <span className="small fw-bold text-muted me-2">PREVIEW ANTREAN MIKROTIK:</span>
                          <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary-subtle rounded-pill px-3 py-1 fw-semibold d-inline-flex align-items-center gap-1">
                            ⚡ Loss Kecepatan (Tanpa Batasan / Full Bandwidth)
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="col-md-12">
                      <label className="form-label small fw-bold text-secondary mb-2">
                        KETERANGAN / DESKRIPSI (OPSIONAL)
                      </label>
                      <textarea
                        className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6"
                        rows="2"
                        placeholder="Tambahkan catatan khusus untuk paket ini..."
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      ></textarea>
                    </div>

                    <div className="col-md-12">
                      <div className="p-3 bg-light rounded-3 border border-secondary-subtle d-flex align-items-center justify-content-between">
                        <div>
                          <label className="form-check-label fw-bold text-dark small mb-1" htmlFor="isActiveSwitch">
                            Status Profil Aktif
                          </label>
                          <p className="text-muted small mb-0">Jika dinonaktifkan, profil ini tidak akan muncul di form pendaftaran user PPPoE baru.</p>
                        </div>
                        <div className="form-check form-switch mb-0">
                          <input
                            className="form-check-input fs-4 shadow-none"
                            type="checkbox"
                            id="isActiveSwitch"
                            checked={form.isActive}
                            onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light py-3 px-4 border-top border-secondary-subtle d-flex align-items-center justify-content-end gap-2">
                  <button type="button" className="btn btn-light border border-secondary-subtle px-4 py-2 rounded-3 fw-medium text-secondary hover-bg-dark transition-all" onClick={() => setModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary px-5 py-2 rounded-3 shadow-sm fw-medium d-flex align-items-center gap-2" disabled={submitting}>
                    {submitting ? <span className="spinner-border spinner-border-sm"></span> : <i className="bi bi-check2-circle fs-5"></i>}
                    {editId ? "Simpan Perubahan" : "Buat Profil Baru"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── KONFIRMASI HAPUS (Clean Modern Alert) ──────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div
          className="modal fade show d-block"
          style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 1060 }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div className="modal-dialog modal-dialog-centered modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-content border-0 rounded-4 shadow-lg p-4 text-center bg-white">
              <div className="modal-body p-0">
                <div className="bg-danger bg-opacity-10 text-danger rounded-circle p-4 d-inline-flex align-items-center justify-content-center mb-3 border border-danger-subtle" style={{ width: "80px", height: "80px" }}>
                  <i className="bi bi-trash3-fill fs-1"></i>
                </div>
                <h5 className="fw-bold text-dark mb-2">Hapus Profil Paket?</h5>
                <p className="text-muted small mb-4">
                  Profil <strong>"{deleteConfirm.name}"</strong> akan dihapus secara permanen dari sistem. Tindakan ini tidak dapat dibatalkan.
                </p>
                <div className="d-flex gap-2 justify-content-center">
                  <button className="btn btn-light border border-secondary-subtle px-4 py-2 rounded-3 fw-medium text-secondary w-50" onClick={() => setDeleteConfirm(null)}>Batal</button>
                  <button className="btn btn-danger px-4 py-2 rounded-3 shadow-sm fw-medium w-50 d-flex align-items-center justify-content-center gap-1" onClick={() => handleDelete(deleteConfirm.id)}>
                    <i className="bi bi-trash me-1"></i> Hapus
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
