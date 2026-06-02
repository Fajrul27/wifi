// components/OdpForm.jsx — Form untuk membuat / edit ODP dari port ODC
import { useState, useEffect } from "react";
import api from "../../../services/api";
import MapPicker from "../../../components/MapPicker";

export default function OdpForm({
  show,
  onClose,
  onSubmit,
  parentOdc,     // odc object yang punya port ini (CREATE mode)
  parentPort,    // odcPort object yang akan di-assign ke ODP ini (CREATE mode)
  editingOdp = null,  // ← NEW: jika diisi maka mode EDIT
}) {
  const [formData, setFormData] = useState({
    name: "",
    splitRatio: "ONE_TO_8",
    latitude: "",
    longitude: "",
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Auto-generate nama / pre-fill data
  useEffect(() => {
    if (!show) return;
    setErrors({});

    if (editingOdp) {
      // EDIT MODE
      setFormData({
        name: editingOdp.name || "",
        splitRatio: editingOdp.splitRatio || "ONE_TO_8",
        latitude: editingOdp.latitude ?? "",
        longitude: editingOdp.longitude ?? "",
      });
    } else if (parentOdc && parentPort) {
      // CREATE MODE
      setFormData({
        name: `ODP-${parentOdc.name?.replace(/\s+/g, "-")}-P${parentPort.index}`,
        splitRatio: "ONE_TO_8",
        latitude: parentOdc.latitude ?? "",
        longitude: parentOdc.longitude ?? "",
      });
    } else {
      setFormData({ name: "", splitRatio: "ONE_TO_8", latitude: "", longitude: "" });
    }
  }, [show, parentOdc, parentPort, editingOdp]);

  const validate = () => {
    const newErrors = {};
    if (!formData.name?.trim()) newErrors.name = "Nama ODP wajib diisi";
    if (!formData.splitRatio) newErrors.splitRatio = "Split ratio wajib dipilih";
    if (
      formData.latitude !== "" && formData.latitude !== null &&
      (isNaN(formData.latitude) || formData.latitude < -90 || formData.latitude > 90)
    ) {
      newErrors.latitude = "Latitude tidak valid";
    }
    if (
      formData.longitude !== "" && formData.longitude !== null &&
      (isNaN(formData.longitude) || formData.longitude < -180 || formData.longitude > 180)
    ) {
      newErrors.longitude = "Longitude tidak valid";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      if (editingOdp) {
        // EDIT MODE → PUT
        const payload = {
          name: formData.name.trim(),
          splitRatio: formData.splitRatio,
          latitude: formData.latitude !== "" ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude !== "" ? parseFloat(formData.longitude) : null,
        };
        const rawOdpId = editingOdp.id;
        const realId = rawOdpId >= 100000 ? rawOdpId - 100000 : rawOdpId;
        await api.put(`/topology/odp/${realId}`, payload);
      } else {
        // CREATE MODE → POST
        const payload = {
          name: formData.name.trim(),
          odcId: Number(parentOdc.id),
          odcPortId: Number(parentPort.id),
          splitRatio: formData.splitRatio,
          latitude: formData.latitude !== "" ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude !== "" ? parseFloat(formData.longitude) : null,
        };
        await api.post("/topology/odp", payload);
      }
      onSubmit?.();
      onClose();
    } catch (err) {
      setErrors({
        submit: err.response?.data?.message || err.message || "Terjadi kesalahan",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  const isEdit = !!editingOdp;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ background: "rgba(0,0,0,0.5)", zIndex: 1055 }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content border-0 shadow">
          <form onSubmit={handleSubmit}>
            {/* HEADER */}
            <div className="modal-header border-bottom-0 pb-0">
              <h6 className="modal-title fw-semibold">
                <i className={`bi bi-${isEdit ? "pencil-square" : "boxes"} me-2 text-info`} />
                {isEdit ? `Edit ODP "${editingOdp.name}"` : "Buat ODP Baru"}
              </h6>
              <button
                type="button"
                className="btn-close btn-close-sm"
                onClick={onClose}
                disabled={loading}
              />
            </div>

            <div className="modal-body py-3">
              {errors.submit && (
                <div className="alert alert-danger py-2 small mb-3">
                  {errors.submit}
                </div>
              )}

              {/* CONTEXT INFO — hanya saat CREATE */}
              {!isEdit && (
                <div className="alert alert-info py-2 small mb-3">
                  <i className="bi bi-git me-1" />
                  ODP dari Port #{parentPort?.index} pada ODC &quot;{parentOdc?.name}&quot;
                </div>
              )}

              {/* NAME */}
              <div className="mb-3">
                <label className="form-label small fw-semibold">Nama ODP *</label>
                <input
                  type="text"
                  className={`form-control form-control-sm ${errors.name ? "is-invalid" : ""}`}
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  disabled={loading}
                  placeholder="Masukkan nama ODP"
                />
                {errors.name && <div className="invalid-feedback">{errors.name}</div>}
              </div>

              {/* SPLIT RATIO */}
              <div className="mb-3">
                <label className="form-label small fw-semibold">Split Ratio *</label>
                <select
                  className={`form-select form-select-sm ${errors.splitRatio ? "is-invalid" : ""}`}
                  value={formData.splitRatio}
                  onChange={(e) => setFormData((p) => ({ ...p, splitRatio: e.target.value }))}
                  disabled={loading}
                >
                  <option value="ONE_TO_2">1:2</option>
                  <option value="ONE_TO_4">1:4</option>
                  <option value="ONE_TO_8">1:8</option>
                  <option value="ONE_TO_16">1:16</option>
                  <option value="ONE_TO_32">1:32</option>
                </select>
                {errors.splitRatio && <div className="invalid-feedback">{errors.splitRatio}</div>}
              </div>

              {/* COORDINATES dengan MapPicker */}
              <div className="mb-2">
                <label className="form-label small fw-semibold">
                  <i className="bi bi-geo-alt me-1 text-primary"></i>
                  Koordinat Lokasi{" "}
                  <span className="text-muted fw-normal">(opsional — klik peta atau tempel dari Google Maps)</span>
                </label>
              </div>
              <div className="rounded-3 overflow-hidden border border-secondary-subtle shadow-sm mb-2">
                <MapPicker
                  key={`odp-map-${editingOdp?.id ?? 'new'}-${show}`}
                  lat={formData.latitude}
                  lng={formData.longitude}
                  height={260}
                  onChange={(lat, lng) =>
                    setFormData((p) => ({
                      ...p,
                      latitude:  lat === "" ? "" : Number(lat).toFixed(7),
                      longitude: lng === "" ? "" : Number(lng).toFixed(7),
                    }))
                  }
                />
              </div>
              {errors.latitude  && <div className="text-danger small mb-1">{errors.latitude}</div>}
              {errors.longitude && <div className="text-danger small">{errors.longitude}</div>}
            </div>

            {/* FOOTER */}
            <div className="modal-footer border-top-0 pt-0">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onClose}
                disabled={loading}
              >
                Batal
              </button>
              <button type="submit" className="btn btn-info btn-sm text-white" disabled={loading}>
                {loading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-1"
                      role="status"
                      aria-hidden="true"
                    />
                    Menyimpan...
                  </>
                ) : isEdit ? (
                  "Simpan Perubahan"
                ) : (
                  "Buat ODP"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
