// components/OdcForm.jsx
import { useState, useEffect } from "react";
import api from "../../../services/api";

export default function OdcForm({
  show,
  onClose,
  onSubmit,
  initialPort,
  olt,
  parentOdc = null,
  parentPort = null
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
    if (parentOdc && parentPort) {
      // CHILD ODC MODE
      setMode("child");
      const portIndex = parentPort?.index ?? parentPort?.port ?? "-";

      setFormData({
        name: `ODC-${parentOdc.name?.replace(/\s+/g, "-")}-C${portIndex}`,
        oltPortId: parentOdc.oltPortId || "", // inherited, not sent to API
        odcPortId: parentPort?.id || "",
        splitRatio: "ONE_TO_4",
        latitude: "",   // child ODC doesn't use lat/long per API
        longitude: ""
      });
    } else if (initialPort && olt) {
      // ROOT ODC MODE
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
    setErrors({});
  }, [initialPort, olt, parentOdc, parentPort, show]);

  // =====================================================
  // VALIDATION
  // =====================================================
  const validate = () => {
    const newErrors = {};

    if (!formData.name?.trim())
      newErrors.name = "Nama ODC wajib diisi";

    if (mode === "root" && !formData.oltPortId)
      newErrors.oltPortId = "Port OLT wajib dipilih";

    if (mode === "child" && !formData.odcPortId)
      newErrors.odcPortId = "Port parent ODC wajib dipilih";

    if (!formData.splitRatio)
      newErrors.splitRatio = "Split ratio wajib dipilih";

    // Only validate coordinates for ROOT ODC
    if (mode === "root") {
      if (
        formData.latitude &&
        (isNaN(formData.latitude) || formData.latitude < -90 || formData.latitude > 90)
      ) {
        newErrors.latitude = "Latitude tidak valid (-90 hingga 90)";
      }
      if (
        formData.longitude &&
        (isNaN(formData.longitude) || formData.longitude < -180 || formData.longitude > 180)
      ) {
        newErrors.longitude = "Longitude tidak valid (-180 hingga 180)";
      }
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
      if (mode === "root") {
        // POST /api/topology/odc
        const payload = {
          name: formData.name.trim(),
          oltPortId: Number(formData.oltPortId),
          splitRatio: formData.splitRatio,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null
        };
        await api.post("/topology/odc", payload);
      } else {
        // POST /api/topology/odc/{parentOdcId}/child
        const payload = {
          name: formData.name.trim(),
          splitRatio: formData.splitRatio,
          odcPortId: Number(formData.odcPortId)
          // NOTE: Child ODC API does NOT accept latitude/longitude
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
                <i
                  className={`bi bi-${
                    mode === "child" ? "diagram-3-fill" : "diagram-3"
                  } me-2 text-primary`}
                ></i>
                {mode === "child" ? "Buat Child ODC" : "Buat ODC Baru"}
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

              {/* CONTEXT INFO */}
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

              {/* COORDINATES - ROOT ODC ONLY */}
              {mode === "root" && (
                <div className="row g-2">
                  <div className="col-6">
                    <label className="form-label small fw-semibold">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      className={`form-control form-control-sm ${
                        errors.latitude ? "is-invalid" : ""
                      }`}
                      placeholder="-6.200000"
                      value={formData.latitude}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, latitude: e.target.value }))
                      }
                      disabled={loading}
                    />
                    {errors.latitude && (
                      <div className="invalid-feedback">{errors.latitude}</div>
                    )}
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-semibold">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      className={`form-control form-control-sm ${
                        errors.longitude ? "is-invalid" : ""
                      }`}
                      placeholder="106.800000"
                      value={formData.longitude}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, longitude: e.target.value }))
                      }
                      disabled={loading}
                    />
                    {errors.longitude && (
                      <div className="invalid-feedback">{errors.longitude}</div>
                    )}
                  </div>
                </div>
              )}

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