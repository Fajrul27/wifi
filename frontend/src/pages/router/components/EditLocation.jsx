import { useState, useEffect } from "react";
import MapPicker from "../../../components/MapPicker";

export default function EditLocation({
  show,
  user,
  routerId,
  onClose,
  onSaved,
}) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (show && user) {
      setLat(user.latitude ?? "");
      setLng(user.longitude ?? "");
      setError("");
    } else {
      setLat("");
      setLng("");
      setError("");
    }
  }, [show, user]);

  if (!show) return null;

  const handleSave = async () => {
    if (!routerId || !user?.id) {
      setError("Data router atau user tidak valid!");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const res = await fetch(
        `http://localhost:3000/api/pppoe/${routerId}/user/${user.id}/location`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: lat === "" ? null : parseFloat(lat),
            longitude: lng === "" ? null : parseFloat(lng),
          }),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Gagal update lokasi");
      }

      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || "Gagal menyimpan lokasi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ background: "rgba(0,0,0,0.5)", zIndex: 1050 }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content border-0 shadow">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-pin-map-fill me-2 text-primary"></i>Atur Lokasi Pelanggan
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
            />
          </div>

          <div className="modal-body">
            <p className="text-muted small mb-3">
              Menentukan koordinat untuk pelanggan: <strong>{user?.username}</strong>
            </p>

            {error && (
              <div className="alert alert-danger py-2 small mb-3">{error}</div>
            )}

            <div className="mb-2">
              <MapPicker
                key={`pppoe-map-${user?.id ?? 'new'}-${show}`}
                lat={lat}
                lng={lng}
                height={260}
                onChange={(newLat, newLng) => {
                  setLat(newLat);
                  setLng(newLng);
                }}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Batal
            </button>

            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Menyimpan..." : "Simpan Lokasi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}