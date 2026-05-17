import React from "react";

export default function TopologyHeader({
  loadData,
  loading,
  stats,
  routers,
  selectedRouter,
  setSelectedRouter,
  openModal,
  provisioningStats,
  selectedTab,
  setSelectedTab,
  showToast,
  filteredOltPortsCount,
  filteredNodesCount,
  pppoeUsersCount,
}) {
  return (
    <>
      {/* ===== HEADER ===== */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h3 className="fw-bold mb-1 text-dark">
            <i className="bi bi-diagram-3-fill me-2 text-primary"></i>FTTH Topology Manager
          </h3>
          <p className="text-muted mb-0 small">Router → OLT Port → ODC → ODP → Splitter → Client</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1" onClick={loadData} disabled={loading}>
            <i className={`bi bi-arrow-clockwise ${loading ? 'spinner-border spinner-border-sm' : ''}`}></i> 
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <span className="badge bg-light text-dark border px-3 py-2">
            <i className="bi bi-hdd-network me-1"></i>
            {stats.activePorts} Ports • {stats.odcCount} ODC • {stats.odpCount} ODP • {stats.assignedUsers} Clients
          </span>
        </div>
      </div>

      {/* ===== ROUTER SELECTOR ===== */}
      <div className="card border shadow-sm mb-4">
        <div className="card-body py-3">
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label small text-muted fw-semibold mb-1">Active Router</label>
              <select className="form-select form-select-sm" value={selectedRouter || ""} onChange={(e) => setSelectedRouter(Number(e.target.value))}>
                {routers.map((r) => (<option key={r.id} value={r.id}>{r.name} {r.host ? `(${r.host})` : ""}</option>))}
              </select>
            </div>
            <div className="col-md-8 d-flex gap-2 justify-content-md-end">
              <button className="btn btn-primary btn-sm" onClick={() => openModal('oltPort')}><i className="bi bi-plus-lg me-1"></i> Add OLT Port</button>
              <button className="btn btn-success btn-sm" onClick={() => openModal('node')}><i className="bi bi-diagram-2 me-1"></i> Add Node</button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== ALERT: MISMATCHED USERS (Online tapi belum Mapping) ===== */}
      {provisioningStats.mismatchedUsers.length > 0 && (
        <div className="alert alert-danger border-0 shadow-sm mb-4 d-flex align-items-center justify-content-between">
          <div>
            <i className="bi bi-exclamation-octagon-fill me-2"></i>
            <strong>Deteksi Otomatis:</strong> Ada <strong>{provisioningStats.mismatchedUsers.length} pelanggan</strong> sudah Online (kabel sudah dicolok) tapi belum terdata di port ODP!
            <div className="small mt-1 opacity-75">
              Pelanggan: {provisioningStats.mismatchedUsers.map(u => u.username).join(', ')}
            </div>
          </div>
          <button 
            className="btn btn-danger btn-sm fw-bold"
            onClick={() => {
              setSelectedTab('pppoe');
              showToast("Silakan klik tombol 'Pasang' pada user yang berlabel NEW dan Online untuk mendata posisi kabelnya.", "info");
            }}
          >
            Data Sekarang
          </button>
        </div>
      )}

      {/* ===== PROVISIONING SUMMARY ===== */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card border-0 shadow-sm bg-primary text-white h-100">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="small opacity-75">Total Port Fiber</div>
                  <h4 className="mb-0 fw-bold">{provisioningStats.totalPorts}</h4>
                </div>
                <i className="bi bi-diagram-3 fs-3 opacity-50"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm bg-success text-white h-100">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="small opacity-75">Port Tersedia</div>
                  <h4 className="mb-0 fw-bold">{provisioningStats.availablePorts}</h4>
                </div>
                <i className="bi bi-check-circle fs-3 opacity-50"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm bg-warning text-dark h-100">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="small opacity-75">Baru (Belum Pasang)</div>
                  <h4 className="mb-0 fw-bold">{provisioningStats.unassignedUsers}</h4>
                </div>
                <i className="bi bi-person-plus fs-3 opacity-50"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm bg-white border h-100">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <div className="small text-muted fw-semibold">Utilisasi Jaringan</div>
                <span className={`badge ${provisioningStats.utilization > 90 ? 'bg-danger' : 'bg-primary'} bg-opacity-10 text-${provisioningStats.utilization > 90 ? 'danger' : 'primary'}`}>
                  {provisioningStats.utilization}%
                </span>
              </div>
              <div className="progress" style={{height: "8px"}}>
                <div className={`progress-bar bg-${provisioningStats.utilization > 90 ? 'danger' : 'primary'}`} style={{width: `${provisioningStats.utilization}%`}}></div>
              </div>
              <div className="small text-muted mt-2" style={{fontSize: "0.7rem"}}>
                {provisioningStats.usedPorts} port terpakai dari {provisioningStats.totalPorts}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== TABS NAVIGATION ===== */}
      <ul className="nav nav-pills mb-4 border-bottom pb-2">
        {[
          { id: 'olt-ports', label: '🔌 OLT Ports', count: filteredOltPortsCount, icon: 'hdd-stack' },
          { id: 'topology', label: '🗺️ Topology', count: filteredNodesCount, icon: 'diagram-2' },
          { id: 'chart', label: '📊 Visual Chart', count: '', icon: 'bar-chart-steps' },
          { id: 'pppoe', label: '👥 PPPoE Users', count: pppoeUsersCount, icon: 'people' },
        ].map(tab => (
          <li className="nav-item me-2" key={tab.id}>
            <button 
              className={`nav-link d-flex align-items-center gap-2 px-3 py-2 ${selectedTab === tab.id ? 'active fw-semibold' : 'text-muted'}`}
              onClick={() => setSelectedTab(tab.id)}
              style={{ borderRadius: '8px', background: selectedTab === tab.id ? '#0d6efd' : 'transparent', color: selectedTab === tab.id ? '#fff' : '#212529', transition: 'all 0.2s ease' }}
            >
              <i className={`bi bi-${tab.icon}`}></i>{tab.label}
              <span className={`badge rounded-pill ${selectedTab === tab.id ? 'bg-light text-primary' : 'bg-light text-dark'}`}>{tab.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
