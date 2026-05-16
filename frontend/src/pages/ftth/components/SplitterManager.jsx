import React from "react";

export default function SplitterManager({ 
  splitters, nodes, onEdit, onDelete, onAssign,
  getSplitterLabel, getNodeName 
}) {
  return (
    <div className="card border shadow-sm">
      <div className="card-header bg-white border-bottom py-3">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-semibold text-dark"><i className="bi bi-diagram-3 me-2 text-primary"></i>Fiber Splitters<span className="badge bg-secondary ms-2">{splitters.length}</span></h5>
          <button className="btn btn-primary btn-sm" onClick={() => onEdit(null)}><i className="bi bi-plus-lg me-1"></i> Add Splitter</button>
        </div>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          {splitters.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-diagram-3 fs-1 d-block mb-3 text-secondary"></i>
              <p className="mb-3">No splitters found</p>
              <button className="btn btn-primary" onClick={() => onEdit(null)}><i className="bi bi-plus-lg me-1"></i> Create first splitter</button>
            </div>
          ) : (
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light"><tr><th>Splitter</th><th>Node</th><th>Type</th><th>Ports</th><th>Usage</th><th className="text-end" style={{ width: "140px" }}>Actions</th></tr></thead>
              <tbody>
                {splitters.map((s) => {
                  const node = nodes.find(n => n.id === s.nodeId);
                  const usedPorts = (s.outputs || []).filter(o => o.isUsed).length;
                  const totalPorts = s.outputPort;
                  const percent = totalPorts ? Math.round((usedPorts / totalPorts) * 100) : 0;
                  return (
                    <tr key={s.id}>
                      <td><strong className="text-dark">{s.name || `Splitter #${s.id}`}</strong>{s.description && <small className="text-muted d-block">{s.description}</small>}</td>
                      <td><span className={`badge ${node?.type === 'ODP' ? 'bg-warning text-dark' : 'bg-info text-dark'}`}>{node?.type}</span><small className="ms-1 text-muted">{node?.name}</small></td>
                      <td>{getSplitterLabel(s.type)}</td>
                      <td>{totalPorts} ports</td>
                      <td><div className="d-flex align-items-center gap-2"><div className="progress" style={{ height: '6px', width: '80px' }}><div className={`progress-bar ${percent > 80 ? 'bg-danger' : percent > 50 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${percent}%` }}></div></div><small className="text-muted">{usedPorts}/{totalPorts}</small></div></td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          {(s.outputs || []).filter(o => !o.isUsed).length > 0 && (<button className="btn btn-outline-warning" onClick={() => { const freeOutput = (s.outputs || []).find(o => !o.isUsed); onAssign(freeOutput?.id); }} title="Assign to Port"><i className="bi bi-person-plus"></i></button>)}
                          <button className="btn btn-outline-danger" onClick={() => onDelete(s.id)} title="Delete"><i className="bi bi-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}