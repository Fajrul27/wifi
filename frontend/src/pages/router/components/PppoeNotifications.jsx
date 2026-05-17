import React from "react";

export default function PppoeNotifications({
  toast,
  setToast,
  confirm,
  setConfirm,
}) {
  return (
    <>
      {/* ========================= CUSTOM TOAST ========================= */}
      {toast.show && (
        <div className={`position-fixed bottom-0 end-0 p-3`} style={{ zIndex: 2000 }}>
          <div className={`toast show align-items-center text-white bg-${toast.type} border-0 shadow-lg`} role="alert">
            <div className="d-flex">
              <div className="toast-body">
                <i className={`bi bi-${toast.type === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2`}></i>
                {toast.message}
              </div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast({ ...toast, show: false })}></button>
            </div>
          </div>
        </div>
      )}

      {/* ========================= CUSTOM CONFIRM DIALOG ========================= */}
      {confirm.show && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 1900 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white">
              <div className="modal-body p-5 text-center">
                <div className="display-4 text-warning mb-3"><i className="bi bi-question-circle-fill"></i></div>
                <h5 className="fw-bold text-dark mb-3 fs-4">Konfirmasi Tindakan</h5>
                <p className="text-secondary mb-4 fs-6" style={{ whiteSpace: 'pre-line' }}>{confirm.message}</p>
                <div className="d-flex gap-3 justify-content-center">
                  <button className="btn btn-secondary rounded-3 px-4 py-2 fw-medium shadow-sm" onClick={() => setConfirm({ show: false, message: "", onConfirm: null })}>Batal</button>
                  <button className="btn btn-primary rounded-3 px-4 py-2 fw-semibold shadow-sm" onClick={() => { confirm.onConfirm(); setConfirm({ show: false, message: "", onConfirm: null }); }}>Ya, Lanjutkan</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
