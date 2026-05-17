import React from "react";

export default function OltPortManager({ 
  loading, oltPorts, nodes, routers, 
  onEdit, onDelete, onAddNode, onViewTopology,
  formatCoord, getRouterName, StatusBadge 
}) {
  return (
    <div className="card border shadow-sm">
      <div className="card-header bg-white border-bottom py-3">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-semibold text-dark"><i className="bi bi-hdd-stack me-2 text-primary"></i>OLT Ports<span className="badge bg-secondary ms-2">{oltPorts.length}</span></h5>
        </div>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          {loading ? (
            <div className="d-flex justify-content-center align-items-center py-5"><div className="spinner-border text-primary" role="status"></div><span className="ms-2 text-muted">Loading ports...</span></div>
          ) : oltPorts.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-3 text-secondary"></i>
              <p className="mb-3">No OLT ports found</p>
              <button className="btn btn-primary" onClick={() => onEdit(null)}><i className="bi bi-plus-lg me-1"></i> Add your first port</button>
            </div>
          ) : (
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light"><tr><th>Name</th><th>Interface</th><th>Router</th><th>Location</th><th>Nodes</th><th className="text-end" style={{ width: "180px" }}>Actions</th></tr></thead>
              <tbody>
                {oltPorts.map((p) => {
                  const nodeCount = nodes.filter(n => n.oltPortId === p.id).length;
                  return (
                    <tr key={p.id}>
                      <td><div className="fw-medium text-dark">{p.name}</div>{(p.latitude || p.longitude) && (<small className="text-muted"><i className="bi bi-geo-alt me-1"></i>{formatCoord(p.latitude)}, {formatCoord(p.longitude)}</small>)}</td>
                      <td><span className="badge bg-light text-dark border">{p.port}</span></td>
                      <td><div className="d-flex align-items-center gap-2"><StatusBadge online={p.router?.isOnline} /><small className="text-muted">{getRouterName(p.routerId)}</small></div></td>
                      <td>{(p.latitude && p.longitude) ? (<a href={`https://maps.google.com/?q=${p.latitude},${p.longitude}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary"><i className="bi bi-map"></i></a>) : <span className="text-muted small">—</span>}</td>
                      <td><span className="badge bg-primary">{nodeCount}</span>{nodeCount > 0 && (<button className="btn btn-sm btn-link p-0 ms-1 text-primary text-decoration-none" onClick={() => onViewTopology(p.id)}>View</button>)}</td>
                      <td className="text-end"><div className="btn-group btn-group-sm"><button className="btn btn-outline-primary" onClick={() => onEdit(p)} title="Edit OLT Port & Maps"><i className="bi bi-pencil"></i></button><button className="btn btn-outline-success" onClick={() => onAddNode(p.id)} title="Add ODC"><i className="bi bi-diagram-2"></i></button><button className="btn btn-outline-danger" onClick={() => onDelete(p.id)} title="Delete"><i className="bi bi-trash"></i></button></div></td>
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