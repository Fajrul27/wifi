// components/OdcForm.jsx
import { useState, useEffect } from "react";
import api from "../../../services/api";
import MapPicker from "../../../components/MapPicker";

export default function OdcForm({
  show,
  onClose,
  onSubmit,
  initialPort,
  olt,
  parentOdc = null,
  parentPort = null,
  editingOdc = null,   // ← NEW: jika diisi maka mode EDIT
}) {
  const [formData, setFormData] = useState({
    name: "",
    oltPortId: "",
    odcPortId: "",
    splitRatio: "ONE_TO_8",
    latitude: "",
    longitude: ""
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [mode, setMode] = useState("root");

  // =====================================================
  // SAFE VALUE HELPER
  // =====================================================
  const safe = (val, fallback = "-") =>
    val === undefined || val === null ? fallback : val;

  // =====================================================
  // INIT FORM DATA BASED ON MODE
  // =====================================================
  useEffect(() => {
    if (!show) return;
    setErrors({});

    if (editingOdc) {
      // EDIT MODE — pre-fill from existing ODC
      setMode(editingOdc.parentOdcId ? "child" : "root");
      setFormData({
        name: editingOdc.name || "",
        oltPortId: editingOdc.oltPortId || "",
        odcPortId: "",
        splitRatio: editingOdc.splitRatio || "ONE_TO_8",
        latitude: editingOdc.latitude ?? "",
        longitude: editingOdc.longitude ?? "",
      });
    } else if (parentOdc && parentPort) {
      // CHILD ODC CREATE MODE
      setMode("child");
      const portIndex = parentPort?.index ?? parentPort?.port ?? "-";
      setFormData({
        name: `ODC-${parentOdc.name?.replace(/\s+/g, "-")}-C${portIndex}`,
        oltPortId: parentOdc.oltPortId || "",
        odcPortId: parentPort?.id || "",
        splitRatio: "ONE_TO_4",
        latitude: parentOdc.latitude ?? "",
        longitude: parentOdc.longitude ?? "",
      });
    } else if (initialPort && olt) {
      // ROOT ODC CREATE MODE
      setMode("root");
      const portNumber = initialPort?.port ?? initialPort?.index ?? "-";
      setFormData({
        name: `ODC-${olt.name?.replace(/\s+/g, "-")}-P${portNumber}`,
        oltPortId: initialPort?.id || "",
        odcPortId: "",
        splitRatio: "ONE_TO_8",
        latitude: olt?.latitude ?? "",
        longitude: olt?.longitude ?? ""
      });
    } else {
      // DEFAULT RESET
      setMode("root");
      setFormData({
        name: "",
        oltPortId: "",
        odcPortId: "",
        splitRatio: "ONE_TO_8",
        latitude: "",
        longitude: ""
      });
    }
  }, [initialPort, olt, parentOdc, parentPort, editingOdc, show]);

  // =====================================================
  // VALIDATION
  // =====================================================
  const validate = () => {
    const newErrors = {};

    if (!formData.name?.trim())
      newErrors.name = "Nama ODC wajib diisi";

    if (!editingOdc) {
      if (mode === "root" && !formData.oltPortId)
        newErrors.oltPortId = "Port OLT wajib dipilih";
      if (mode === "child" && !formData.odcPortId)
        newErrors.odcPortId = "Port parent ODC wajib dipilih";
    }

    if (!formData.splitRatio)
      newErrors.splitRatio = "Split ratio wajib dipilih";

    if (
      formData.latitude !== "" && formData.latitude !== null &&
      (isNaN(formData.latitude) || formData.latitude < -90 || formData.latitude > 90)
    ) {
      newErrors.latitude = "Latitude tidak valid (-90 hingga 90)";
    }
    if (
      formData.longitude !== "" && formData.longitude !== null &&
      (isNaN(formData.longitude) || formData.longitude < -180 || formData.longitude > 180)
    ) {
      newErrors.longitude = "Longitude tidak valid (-180 hingga 180)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // =====================================================
  // SUBMIT HANDLER
  // =====================================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    try {
      if (editingOdc) {
        // EDIT MODE → PUT
        const payload = {
          name: formData.name.trim(),
          splitRatio: formData.splitRatio,
          latitude: formData.latitude !== "" ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude !== "" ? parseFloat(formData.longitude) : null,
        };
        await api.put(`/topology/odc/${editingOdc.id}`, payload);
      } else if (mode === "root") {
        const payload = {
          name: formData.name.trim(),
          oltPortId: Number(formData.oltPortId),
          splitRatio: formData.splitRatio,
          latitude: formData.latitude !== "" ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude !== "" ? parseFloat(formData.longitude) : null
        };
        await api.post("/topology/odc", payload);
      } else {
        const payload = {
          name: formData.name.trim(),
          splitRatio: formData.splitRatio,
          odcPortId: Number(formData.odcPortId),
          latitude: formData.latitude !== "" ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude !== "" ? parseFloat(formData.longitude) : null,
        };
        await api.post(`/topology/odc/${parentOdc.id}/child`, payload);
      }

      onSubmit?.();
      onClose();
    } catch (err) {
      setErrors({
        submit: err.response?.data?.message || err.message || "Terjadi kesalahan"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  const isEdit = !!editingOdc;
  const titleText = isEdit
    ? `Edit ODC "${editingOdc.name}"`
    : mode === "child"
    ? "Buat Child ODC"
    : "Buat ODC Baru";

  const iconClass = isEdit
    ? "pencil-square"
    : mode === "child"
    ? "diagram-3-fill"
    : "diagram-3";

  // =====================================================
  // RENDER UI
  // =====================================================
  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ background: "rgba(0,0,0,0.5)", zIndex: 1055 }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content border-0 shadow">
          <form onSubmit={handleSubmit}>
            {/* HEADER */}
            <div className="modal-header border-bottom-0 pb-0">
              <h6 className="modal-title fw-semibold">
                <i className={`bi bi-${iconClass} me-2 text-primary`}></i>
                {titleText}
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
                <div
                  className={`alert py-2 small mb-3 ${
                    mode === "child" ? "alert-warning" : "alert-info"
                  }`}
                >
                  <i
                    className={`bi bi-${
                      mode === "child" ? "git-branch" : "info-circle"
                    } me-1`}
                  ></i>
                  {mode === "child"
                    ? `Child ODC dari Port #${safe(
                        parentPort?.index ?? parentPort?.port
                      )} pada "${safe(parentOdc?.name)}"`
                    : `ODC dari Port ${safe(
                        initialPort?.port ?? initialPort?.index
                      )} pada OLT "${safe(olt?.name)}"`}
                </div>
              )}

              {/* NAME */}
              <div className="mb-3">
                <label className="form-label small fw-semibold">Nama ODC *</label>
                <input
                  type="text"
                  className={`form-control form-control-sm ${
                    errors.name ? "is-invalid" : ""
                  }`}
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, name: e.target.value }))
                  }
                  disabled={loading}
                  placeholder="Masukkan nama ODC"
                />
                {errors.name && (
                  <div className="invalid-feedback">{errors.name}</div>
                )}
              </div>

              {/* SPLIT RATIO */}
              <div className="mb-3">
                <label className="form-label small fw-semibold">Split Ratio *</label>
                <select
                  className={`form-select form-select-sm ${
                    errors.splitRatio ? "is-invalid" : ""
                  }`}
                  value={formData.splitRatio}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, splitRatio: e.target.value }))
                  }
                  disabled={loading}
                >
                  <option value="ONE_TO_2">1:2</option>
                  <option value="ONE_TO_4">1:4</option>
                  <option value="ONE_TO_8">1:8</option>
                  <option value="ONE_TO_16">1:16</option>
                  <option value="ONE_TO_32">1:32</option>
                </select>
                {errors.splitRatio && (
                  <div className="invalid-feedback">{errors.splitRatio}</div>
                )}
              </div>

              {/* COORDINATES — dengan MapPicker interaktif */}
              <div className="mb-2">
                <label className="form-label small fw-semibold">
                  <i className="bi bi-geo-alt me-1 text-primary"></i>
                  Koordinat Lokasi{" "}
                  <span className="text-muted fw-normal">(opsional — klik peta atau tempel dari Google Maps)</span>
                </label>
              </div>
              <div className="rounded-3 overflow-hidden border border-secondary-subtle shadow-sm mb-2">
                <MapPicker
                  key={`odc-map-${editingOdc?.id ?? 'new'}-${show}`}
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

              {/* HIDDEN FIELDS FOR REFERENCE */}
              <input type="hidden" name="oltPortId" value={formData.oltPortId} />
              <input type="hidden" name="odcPortId" value={formData.odcPortId} />
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
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-1"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Menyimpan...
                  </>
                ) : isEdit ? (
                  "Simpan Perubahan"
                ) : mode === "child" ? (
                  "Buat Child ODC"
                ) : (
                  "Buat ODC"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}