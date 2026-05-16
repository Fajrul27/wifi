import React from "react";

export default function TopologyManager({ 
  loading, nodes, oltPorts, splitters,
  onEdit, onDelete, onAddChild, onAddSplitter, onAssignClient,
  getOdpAvailablePorts, getNodeName, getRouterName, formatCoord 
}) {
  return (
    <div className="card border shadow-sm">
      <div className="card-header bg-white border-bottom py-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h5 className="mb-0 fw-semibold text-dark"><i className="bi bi-diagram-2 me-2 text-primary"></i>Topology Nodes<span className="badge bg-secondary ms-2">{nodes.length}</span></h5>
          <div className="d-flex gap-2">
            <select className="form-select form-select-sm" style={{ width: 'auto' }} value={""} onChange={() => {}}>
              <option value="">All OLT Ports</option>
              {oltPorts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="btn btn-success btn-sm" onClick={() => onEdit(null)}><i className="bi bi-plus-lg me-1"></i> Add Node</button>
          </div>
        </div>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          {nodes.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-diagram-2 fs-1 d-block mb-3 text-secondary"></i>
              <p className="mb-3">No topology nodes found</p>
              <button className="btn btn-success" onClick={() => onEdit(null)}><i className="bi bi-plus-lg me-1"></i> Create first node</button>
            </div>
          ) : (
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light"><tr><th>Name</th><th>Type</th><th>Source</th><th>Location</th><th>Connected</th><th className="text-end" style={{ width: "200px" }}>Actions</th></tr></thead>
              <tbody>
                {nodes.map((n) => {
                  const availablePorts = getOdpAvailablePorts(n);
                  return (
                    <tr key={n.id}>
                      <td><div className="fw-medium text-dark">{n.name}</div>{n.description && <small className="text-muted d-block">{n.description}</small>}</td>
                      <td><span className={`badge ${n.type === 'ODP' ? 'bg-warning text-dark' : 'bg-info text-dark'}`}>{n.type}</span></td>
                      <td>{n.oltPort ? (<small className="text-muted">{n.oltPort.name} • {getRouterName(n.oltPort.routerId)}</small>) : n.incomingLinks?.[0]?.fromNode ? (<small className="text-muted">From: {n.incomingLinks[0].fromNode.name}</small>) : <span className="text-muted small">—</span>}</td>
                      <td>{(n.latitude && n.longitude) ? (<a href={`https://maps.google.com/?q=${n.latitude},${n.longitude}`} target="_blank" rel="noopener" className="btn btn-sm btn-outline-primary"><i className="bi bi-map"></i></a>) : <span className="text-muted small">—</span>}</td>
                      <td>{n.type === 'ODP' ? (<span className="badge bg-warning text-dark">{availablePorts} ports available</span>) : (<small className="text-muted">{n._count?.outgoingLinks || 0} children</small>)}</td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          {n.type === 'ODC' && (<><button className="btn btn-outline-success" onClick={() => onAddChild(n.id, 'ODC')} title="Add ODC Child"><i className="bi bi-plus"></i> ODC</button><button className="btn btn-outline-warning" onClick={() => onAddChild(n.id, 'ODP')} title="Add ODP"><i className="bi bi-plus"></i> ODP</button><button className="btn btn-outline-info" onClick={() => onAddSplitter(n.id)} title="Add Splitter"><i className="bi bi-diagram-3"></i></button></>)}
                          {n.type === 'ODP' && availablePorts > 0 && (<button className="btn btn-outline-warning" onClick={() => onAssignClient(n.id)} title="Assign Client"><i className="bi bi-person-plus"></i></button>)}
                          <button className="btn btn-outline-danger" onClick={() => onDelete(n.id)} title="Delete"><i className="bi bi-trash"></i></button>
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