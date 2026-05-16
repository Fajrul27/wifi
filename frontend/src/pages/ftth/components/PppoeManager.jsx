import React, { useState } from "react";

export default function PppoeManager({ 
  users, nodes, availableUsers, onAssign, onUnassign, onEditLocation, formatCoord, StatusBadge 
}) {
  const [filter, setFilter] = useState("all"); // all, unassigned, assigned

  const filteredUsers = users.filter(u => {
    if (filter === "unassigned") return !u.topologyNodeId;
    if (filter === "assigned") return !!u.topologyNodeId;
    return true;
  });

  return (
    <div className="card border shadow-sm">
      <div className="card-header bg-white border-bottom py-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <h5 className="mb-0 fw-semibold text-dark">
            <i className="bi bi-people me-2 text-primary"></i>PPPoE Users
            <span className="badge bg-secondary ms-2">{users.length}</span>
          </h5>
          
          <div className="btn-group btn-group-sm">
            <button 
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setFilter('all')}
            >
              Semua
            </button>
            <button 
              className={`btn ${filter === 'unassigned' ? 'btn-warning' : 'btn-outline-warning'}`}
              onClick={() => setFilter('unassigned')}
            >
              Belum Pasang ({users.filter(u => !u.topologyNodeId).length})
            </button>
            <button 
              className={`btn ${filter === 'assigned' ? 'btn-success' : 'btn-outline-success'}`}
              onClick={() => setFilter('assigned')}
            >
              Sudah Pasang
            </button>
          </div>
        </div>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className={`bi ${filter === 'unassigned' ? 'bi-check-circle' : 'bi-inbox'} fs-1 d-block mb-3 text-secondary`}></i>
              <p className="mb-0">
                {filter === 'unassigned' ? 'Semua pelanggan sudah terpasang jalur fisik.' : 'Tidak ada data pelanggan ditemukan.'}
              </p>
            </div>
          ) : (
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>User</th>
                  <th>IP Address</th>
                  <th>Status</th>
                  <th>Terhubung Ke</th>
                  <th>Lokasi</th>
                  <th className="text-end" style={{ width: "160px" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const assignedNode = nodes.find(n => n.id === u.topologyNodeId);
                  return (
                    <tr key={u.id} className={!u.isOnline ? 'opacity-75' : ''}>
                      <td>
                        <div className="d-flex align-items-center">
                          <strong className="text-dark">{u.username}</strong>
                          {!u.topologyNodeId && (
                            <span className="badge bg-warning text-dark ms-2" style={{fontSize: "0.6rem"}}>NEW</span>
                          )}
                        </div>
                        {u.comment && <div className="small text-muted" style={{fontSize: "0.7rem"}}>{u.comment}</div>}
                      </td>
                      <td><code className="small bg-light px-2 py-1 rounded">{u.remoteAddress || '—'}</code></td>
                      <td><StatusBadge online={u.isOnline} /></td>
                      <td>
                        {assignedNode ? (
                          <div className="d-flex flex-column">
                            <span className="badge bg-success-subtle text-success border border-success-subtle mb-1" style={{width: "fit-content"}}>
                              {assignedNode.name}
                            </span>
                            <small className="text-muted" style={{fontSize: "0.65rem"}}>{assignedNode.type}</small>
                          </div>
                        ) : (
                          <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle">Unassigned</span>
                        )}
                      </td>
                      <td>
                        {u.latitude && u.longitude ? (
                          <a href={`https://maps.google.com/?q=${u.latitude},${u.longitude}`} target="_blank" rel="noopener noreferrer" className="text-decoration-none small text-primary d-flex align-items-center">
                            <i className="bi bi-geo-alt-fill me-1"></i>
                            {formatCoord(u.latitude)}, {formatCoord(u.longitude)}
                          </a>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button 
                            className="btn btn-outline-primary"
                            onClick={() => onEditLocation(u)}
                            title="Edit Lokasi / Koordinat"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          {!u.topologyNodeId ? (
                            <button 
                              className="btn btn-warning" 
                              onClick={() => onAssign(u.id)} 
                              title="Assign/Pasang Jalur"
                            >
                              <i className="bi bi-person-plus-fill me-1"></i> Pasang
                            </button>
                          ) : (
                            <button 
                              className="btn btn-outline-danger" 
                              onClick={() => onUnassign(u.id)} 
                              title="Lepas Jalur (Putus Langganan)"
                            >
                              <i className="bi bi-person-dash"></i> Putus
                            </button>
                          )}
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