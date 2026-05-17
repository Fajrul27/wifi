import React from "react";
import MapPicker from "../../../components/MapPicker";

export default function PppoeModals({
  // Location Modal Props
  showLocationModal,
  closeLocationModal,
  selectedUser,
  latitude,
  setLatitude,
  longitude,
  setLongitude,
  saveLocation,
  savingLocation,

  // Crud Modal Props
  crudModal,
  setCrudModal,
  crudMode,
  crudUser,
  crudForm,
  setCrudForm,
  crudError,
  crudTab,
  setCrudTab,
  mikrotikProfiles,
  dbProfiles,
  profilesLoading,
  handleCrudSubmit,
  crudLoading,
}) {
  return (
    <>
      {/* ========================= LOCATION EDIT MODAL — Peta Interaktif ========================= */}
      {showLocationModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 1050 }}
          onClick={closeLocationModal}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white" style={{ maxHeight: "90vh" }}>
              <div className="modal-header bg-light py-3 px-4 border-bottom border-secondary-subtle d-flex align-items-center justify-content-between">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2 fs-5">
                  <div className="bg-danger bg-opacity-10 text-danger p-2 rounded-3 d-flex align-items-center justify-content-center">
                    <i className="bi bi-geo-alt-fill"></i>
                  </div>
                  <span>Lokasi Pelanggan: <strong className="text-primary">{selectedUser?.username}</strong></span>
                </h5>
                <button type="button" className="btn-close bg-secondary bg-opacity-10 p-2 rounded-circle shadow-none" onClick={closeLocationModal}></button>
              </div>
              <div className="modal-body p-4 overflow-y-auto">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <small className="text-muted fw-medium">
                    <i className="bi bi-hand-index me-1 text-primary"></i>
                    Klik pada peta untuk menandai atau memindahkan koordinat akurat rumah pelanggan
                  </small>
                  {latitude && longitude && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger rounded-3 py-1 px-2 shadow-sm"
                      onClick={() => { setLatitude(""); setLongitude(""); }}
                    >
                      <i className="bi bi-x-circle me-1"></i>Hapus Pin
                    </button>
                  )}
                </div>
                <div className="rounded-4 overflow-hidden border border-secondary-subtle shadow-sm mb-3">
                  <MapPicker
                    key={`loc-map-${selectedUser?.id}-${showLocationModal}`}
                    lat={latitude}
                    lng={longitude}
                    height={300}
                    onChange={(lat, lng) => {
                      setLatitude(lat === "" ? "" : Number(lat).toFixed(7));
                      setLongitude(lng === "" ? "" : Number(lng).toFixed(7));
                    }}
                  />
                </div>
                {latitude && longitude && (
                  <div className="d-flex justify-content-end">
                    <a
                      href={`https://maps.google.com/?q=${latitude},${longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-success rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1 fw-medium"
                    >
                      <i className="bi bi-box-arrow-up-right"></i> Buka di Google Maps
                    </a>
                  </div>
                )}
              </div>
              <div className="modal-footer py-3 px-4 bg-light border-top border-secondary-subtle">
                <button type="button" className="btn btn-secondary rounded-3 px-4 py-2 fw-medium shadow-sm" onClick={closeLocationModal}>Batal</button>
                <button
                  type="button"
                  className="btn btn-primary rounded-3 px-4 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2"
                  onClick={saveLocation}
                  disabled={savingLocation}
                >
                  {savingLocation ? (
                    <><span className="spinner-border spinner-border-sm" role="status"></span> Menyimpan...</>
                  ) : (
                    <><i className="bi bi-check-lg"></i> Simpan Lokasi</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================= CRUD MODAL: ADD / EDIT USER — LENGKAP ========================= */}
      {crudModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 1060 }}
          onClick={() => setCrudModal(false)}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white" style={{ maxHeight: "90vh" }}>

              {/* HEADER */}
              <div className="modal-header bg-light py-3 px-4 border-bottom border-secondary-subtle d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-3">
                  <div className={`p-2 rounded-3 d-flex align-items-center justify-content-center ${crudMode === 'add' ? 'bg-primary bg-opacity-10 text-primary' : 'bg-warning bg-opacity-10 text-warning'}`}>
                    <i className={`bi fs-4 ${crudMode === 'add' ? 'bi-person-plus-fill' : 'bi-person-gear'}`}></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark mb-0 fs-5">
                      {crudMode === 'add' ? 'Tambah User PPPoE' : `Edit User: ${crudUser?.username}`}
                    </h5>
                    <small className="text-muted d-block mt-1">
                      {crudMode === 'add' ? 'Tambah akun PPPoE baru langsung ke Mikrotik' : 'Ubah profile, kecepatan, lokasi, atau deskripsi'}
                    </small>
                  </div>
                </div>
                <button type="button" className="btn-close bg-secondary bg-opacity-10 p-2 rounded-circle shadow-none" onClick={() => setCrudModal(false)}></button>
              </div>

              {/* TABS & BODY */}
              <div className="modal-body p-4 overflow-y-auto">
                {crudError && (
                  <div className="alert alert-danger border border-danger-subtle bg-danger bg-opacity-10 rounded-4 p-3 small mb-4 shadow-sm d-flex align-items-center gap-2">
                    <i className="bi bi-exclamation-triangle-fill text-danger fs-5"></i>
                    <div>{crudError}</div>
                  </div>
                )}

                {/* Tab Nav */}
                <ul className="nav nav-pills nav-fill mb-4 bg-light border border-secondary-subtle rounded-4 p-1 shadow-sm">
                  {[
                    { key: 'info',   icon: 'bi-person-badge', label: 'Info & Profile' },
                    { key: 'lokasi', icon: 'bi-geo-alt',      label: 'Lokasi GPS' },
                  ].map(t => (
                    <li className="nav-item" key={t.key}>
                      <button
                        className={`nav-link rounded-3 py-2 fw-semibold transition-all ${crudTab === t.key ? 'active bg-primary text-white shadow-sm' : 'text-secondary'}`}
                        onClick={() => setCrudTab(t.key)}
                      >
                        <i className={`bi ${t.icon} me-2`}></i>{t.label}
                      </button>
                    </li>
                  ))}
                </ul>

                {/* ─── TAB: INFO & PROFILE ─── */}
                {crudTab === 'info' && (
                  <div className="row g-4">
                    <div className="col-12">
                      <label className="form-label small fw-bold text-secondary mb-1">Username PPPoE</label>
                      <input
                        type="text"
                        className={`form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none ${crudMode === 'edit' ? 'bg-light' : ''}`}
                        placeholder="contoh: pelanggan-01"
                        value={crudForm.username}
                        disabled={crudMode === 'edit'}
                        onChange={(e) => setCrudForm(f => ({ ...f, username: e.target.value }))}
                      />
                      {crudMode === 'edit' && <div className="form-text text-muted mt-1"><i className="bi bi-info-circle me-1"></i> Username tidak dapat diubah setelah dibuat</div>}
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-bold text-secondary mb-1">Password PPPoE</label>
                      <input
                        type="text"
                        className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                        placeholder={crudMode === 'edit' ? '(kosongkan jika tidak ingin mengubah password)' : 'Masukkan password (default: 12345678)'}
                        value={crudForm.password}
                        onChange={(e) => setCrudForm(f => ({ ...f, password: e.target.value }))}
                      />
                      {crudMode === 'add' && <div className="form-text text-muted mt-1"><i className="bi bi-info-circle me-1"></i> Default password disetel ke 12345678 untuk kemudahan</div>}
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-bold text-secondary mb-1 d-flex justify-content-between align-items-center">
                        <span><i className="bi bi-speedometer2 me-1 text-primary"></i> Profile Kecepatan</span>
                        {profilesLoading && <span className="spinner-border spinner-border-sm text-primary"></span>}
                      </label>
                      {/* Gabungan DB + Mikrotik profiles */}
                      {(dbProfiles.length > 0 || mikrotikProfiles.length > 0) ? (
                        <>
                          <select
                            className="form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                            value={crudForm.profile}
                            onChange={(e) => setCrudForm(f => ({ ...f, profile: e.target.value }))}
                          >
                            <option value="">— Pilih Profile —</option>
                            {!dbProfiles.some(p => p.name === "5 Mbps") && !mikrotikProfiles.some(p => p.name === "5 Mbps") && (
                              <option value="5 Mbps">⚡ 5 Mbps (5M/5M - Default)</option>
                            )}
                            {/* Profil dari DB */}
                            {dbProfiles.filter(p => p.isActive).length > 0 && (
                              <optgroup label="📋 Profil Tersimpan">
                                {dbProfiles.filter(p => p.isActive).map(p => (
                                  <option key={`db-${p.id}`} value={p.name}>
                                    {p.name} ({p.rateLimit})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {/* Profil dari Mikrotik yang belum ada di DB */}
                            {mikrotikProfiles.filter(mp => !dbProfiles.some(dp => dp.name === mp.name)).length > 0 && (
                              <optgroup label="🔧 Profil Mikrotik">
                                {mikrotikProfiles
                                  .filter(mp => !dbProfiles.some(dp => dp.name === mp.name))
                                  .map(p => (
                                    <option key={`mt-${p.name}`} value={p.name}>
                                      {p.name}{p.rateLimit ? ` (${p.rateLimit})` : ''}
                                    </option>
                                  ))}
                              </optgroup>
                            )}
                            <option value="__custom__">✏️ Kustom / Input Manual Mbps</option>
                          </select>

                          {/* Form Input Manual Mbps */}
                          {crudForm.profile === "__custom__" ? (
                            <div className="mt-3 p-4 bg-primary bg-opacity-10 border border-primary-subtle rounded-4 shadow-sm">
                              <small className="fw-bold text-primary d-block mb-3 fs-6"><i className="bi bi-sliders me-2"></i> Konfigurasi Kecepatan Manual</small>
                              <div className="mb-3">
                                <label className="form-label small fw-bold text-secondary mb-1">Nama Profil Baru</label>
                                <input
                                  type="text"
                                  className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                                  placeholder="contoh: 35 Mbps, Paket Kustom"
                                  value={crudForm.customProfileName}
                                  onChange={e => setCrudForm(f => ({ ...f, customProfileName: e.target.value }))}
                                  required={crudForm.profile === "__custom__"}
                                />
                              </div>
                              <div>
                                <label className="form-label small fw-bold text-secondary mb-1">Limit Kecepatan (Rate Limit)</label>
                                <input
                                  type="text"
                                  className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                                  placeholder="contoh: 35M/35M atau 10240k/10240k"
                                  value={crudForm.customRateLimit}
                                  onChange={e => setCrudForm(f => ({ ...f, customRateLimit: e.target.value }))}
                                  required={crudForm.profile === "__custom__"}
                                />
                                <div className="form-text text-muted mt-1 small"><i className="bi bi-info-circle me-1"></i> Format: [Upload]/[Download]. Contoh: 35M/35M</div>
                              </div>
                            </div>
                          ) : crudForm.profile ? (() => {
                            const dbMatch = dbProfiles.find(p => p.name === crudForm.profile);
                            const mtMatch = mikrotikProfiles.find(p => p.name === crudForm.profile);
                            const rate = dbMatch?.rateLimit || mtMatch?.rateLimit || (crudForm.profile === "5 Mbps" ? "5M/5M" : null);
                            return rate ? (
                              <div className="mt-3 p-3 border border-primary-subtle bg-primary bg-opacity-10 rounded-4 shadow-sm d-flex align-items-center gap-2">
                                <i className="bi bi-lightning-charge-fill text-primary fs-5"></i>
                                <div><small className="text-secondary fw-medium">Batas Kecepatan:</small> <strong className="text-primary">{rate}</strong></div>
                              </div>
                            ) : null;
                          })() : null}
                        </>
                      ) : (
                        <input
                          type="text"
                          className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                          placeholder="contoh: default, 10Mbps (ketik manual)"
                          value={crudForm.profile}
                          onChange={(e) => setCrudForm(f => ({ ...f, profile: e.target.value }))}
                        />
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Remote IP Address (IP Pelanggan)</label>
                      <input
                        type="text"
                        className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                        placeholder="contoh: 192.168.10.50 (opsional)"
                        value={crudForm.remoteAddress}
                        onChange={(e) => setCrudForm(f => ({ ...f, remoteAddress: e.target.value }))}
                      />
                      <div className="form-text text-muted mt-1 small"><i className="bi bi-info-circle me-1"></i> Kosongkan untuk menggunakan IP otomatis dari Pool</div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Local IP Address (IP Gateway)</label>
                      <input
                        type="text"
                        className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                        placeholder="contoh: 192.168.10.1 (opsional)"
                        value={crudForm.localAddress}
                        onChange={(e) => setCrudForm(f => ({ ...f, localAddress: e.target.value }))}
                      />
                      <div className="form-text text-muted mt-1 small"><i className="bi bi-info-circle me-1"></i> Kosongkan untuk mengikuti gateway profil</div>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-bold text-secondary mb-1">
                        <i className="bi bi-card-text me-1 text-secondary"></i> Catatan / Keterangan Pelanggan
                      </label>
                      <textarea
                        className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                        rows={2}
                        placeholder="Nama lengkap, alamat rumah, nomor telepon, dll."
                        value={crudForm.keterangan}
                        onChange={(e) => setCrudForm(f => ({ ...f, keterangan: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                {/* ─── TAB: LOKASI GPS (Peta Interaktif) ─── */}
                {crudTab === 'lokasi' && (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <small className="text-muted fw-medium">
                        <i className="bi bi-hand-index me-1 text-primary"></i>
                        Klik pada peta untuk menentukan koordinat akurat rumah pelanggan
                      </small>
                      {crudForm.latitude && crudForm.longitude && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger rounded-3 py-1 px-2 shadow-sm"
                          onClick={() => setCrudForm(f => ({ ...f, latitude: "", longitude: "" }))}
                        >
                          <i className="bi bi-x-circle me-1"></i>Hapus Pin
                        </button>
                      )}
                    </div>
                    <div className="rounded-4 overflow-hidden border border-secondary-subtle shadow-sm mb-3">
                      <MapPicker
                        key={`crud-map-${crudModal}-${crudTab}`}
                        lat={crudForm.latitude}
                        lng={crudForm.longitude}
                        height={300}
                        onChange={(lat, lng) => setCrudForm(f => ({
                          ...f,
                          latitude: lat === "" ? "" : Number(lat).toFixed(7),
                          longitude: lng === "" ? "" : Number(lng).toFixed(7),
                        }))}
                      />
                    </div>
                    {crudForm.latitude && crudForm.longitude && (
                      <div className="d-flex justify-content-end">
                        <a
                          href={`https://maps.google.com/?q=${crudForm.latitude},${crudForm.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline-success rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1 fw-medium"
                        >
                          <i className="bi bi-box-arrow-up-right"></i> Buka di Google Maps
                        </a>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* FOOTER */}
              <div className="modal-footer py-3 px-4 bg-light border-top border-secondary-subtle">
                <button type="button" className="btn btn-secondary rounded-3 px-4 py-2 fw-medium shadow-sm" onClick={() => setCrudModal(false)}>
                  Batal
                </button>
                <button
                  type="button"
                  className="btn btn-primary rounded-3 px-4 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2"
                  onClick={handleCrudSubmit}
                  disabled={crudLoading}
                >
                  {crudLoading ? (
                    <><span className="spinner-border spinner-border-sm" role="status"></span> Menyimpan...</>
                  ) : (
                    <><i className="bi bi-check-lg"></i> {crudMode === 'add' ? 'Tambah User' : 'Simpan Perubahan'}</>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
