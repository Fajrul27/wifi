import React from "react";

export default function TopologyDeleteModal({
  deleteId,
  deleteType,
  oltPorts,
  nodes,
  splitters,
  confirmDelete,
  onCancel,
}) {
  if (!deleteId) return null;

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 1050 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white">
          <div className="modal-header bg-danger bg-opacity-10 py-3 px-4 border-bottom border-danger-subtle d-flex align-items-center justify-content-between">
            <h5 className="modal-title text-danger fw-bold d-flex align-items-center gap-2 fs-5 mb-0">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <span>Hapus {deleteType === 'oltPort' ? 'OLT Port' : deleteType === 'node' ? 'Node' : 'Splitter'}?</span>
            </h5>
            <button type="button" className="btn-close bg-danger bg-opacity-10 p-2 rounded-circle shadow-none" onClick={onCancel}></button>
          </div>
          <div className="modal-body p-4">
            <p className="text-secondary mb-0 fs-6">Apakah Anda yakin ingin menghapus item ini? <br/><strong className="text-danger fw-semibold">Tindakan ini tidak dapat dibatalkan.</strong></p>
            {deleteType === 'oltPort' && oltPorts.find(p => p.id === deleteId) && (<div className="mt-4 p-3 bg-light border border-secondary-subtle rounded-4 shadow-sm"><div className="small text-muted fw-medium mb-1">Item yang akan dihapus:</div><div className="fw-bold text-dark fs-6">{oltPorts.find(p => p.id === deleteId)?.name}</div><div className="small text-muted mt-1"><code className="bg-secondary bg-opacity-10 px-2 py-1 rounded text-dark fw-semibold">{oltPorts.find(p => p.id === deleteId)?.port}</code></div></div>)}
            {deleteType === 'node' && nodes.find(n => n.id === deleteId) && (<div className="mt-4 p-3 bg-light border border-secondary-subtle rounded-4 shadow-sm"><div className="small text-muted fw-medium mb-1">Item yang akan dihapus:</div><div className="fw-bold text-dark fs-6">{nodes.find(n => n.id === deleteId)?.name}</div><div className="small text-muted mt-1">Tipe: <span className="badge bg-secondary">{nodes.find(n => n.id === deleteId)?.type}</span></div></div>)}
            {deleteType === 'splitter' && splitters.find(s => s.id === deleteId) && (<div className="mt-4 p-3 bg-light border border-secondary-subtle rounded-4 shadow-sm"><div className="small text-muted fw-medium mb-1">Splitter yang akan dihapus:</div><div className="fw-bold text-dark fs-6">{splitters.find(s => s.id === deleteId)?.name || `Splitter #${deleteId}`}</div></div>)}
          </div>
          <div className="modal-footer py-3 px-4 bg-light border-top border-secondary-subtle justify-content-end gap-2">
            <button className="btn btn-secondary rounded-3 px-4 py-2 fw-medium shadow-sm" onClick={onCancel}>Batal</button>
            <button className="btn btn-danger rounded-3 px-4 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2" onClick={confirmDelete}><i className="bi bi-trash"></i>Ya, Hapus</button>
          </div>
        </div>
      </div>
    </div>
  );
}
