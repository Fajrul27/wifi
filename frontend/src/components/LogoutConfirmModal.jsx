export default function LogoutConfirmModal({
  open,
  loading,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      role="dialog"
      style={{ background: "rgba(15, 23, 42, 0.5)" }}
    >
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content border-0 shadow-lg rounded-4">

          {/* HEADER */}
          <div className="modal-header border-0">
            <h5 className="modal-title fw-semibold text-dark">
              Confirm Logout
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onCancel}
              disabled={loading}
            />
          </div>

          {/* BODY */}
          <div className="modal-body">
            <p className="text-secondary mb-0">
              Are you sure you want to logout from your account? You will need
              to login again to continue.
            </p>
          </div>

          {/* FOOTER */}
          <div className="modal-footer border-0">

            <button
              className="btn btn-light border"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              className="btn btn-danger px-4"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? "Logging out..." : "Logout"}
            </button>

          </div>

        </div>
      </div>
    </div>
  );
}