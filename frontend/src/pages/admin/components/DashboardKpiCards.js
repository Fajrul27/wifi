import React from 'react';

export default function DashboardKpiCards({
  activeRouters,
  totalRouters,
  onlineClients,
  totalClients,
  odcCount,
  odpCount,
  faultyNodesCount,
  filteredNodesLength
}) {
  const healthPercentage = Math.max(0, 100 - Math.round((faultyNodesCount / (filteredNodesLength || 1)) * 100));

  return (
    <div className="row g-3 mb-3 flex-shrink-0">
      <div className="col-12 col-sm-6 col-xl-3">
        <div className="card border-0 rounded-4 h-100 kpi-card overflow-hidden bg-body shadow-sm">
          <div className="card-body p-3 d-flex align-items-center position-relative">
            <div className="kpi-icon bg-info bg-opacity-10 text-info rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '42px', height: '42px', fontSize: '18px' }}>
              <i className="bi bi-router"></i>
            </div>
            <div>
              <h6 className="text-muted mb-1 fw-semibold small text-uppercase">Routers Status</h6>
              <h5 className="mb-0 fw-bold">{activeRouters} <span className="fs-6 text-muted fw-normal">/ {totalRouters} Active</span></h5>
            </div>
          </div>
        </div>
      </div>

      <div className="col-12 col-sm-6 col-xl-3">
        <div className="card border-0 rounded-4 h-100 kpi-card overflow-hidden bg-body shadow-sm">
          <div className="card-body p-3 d-flex align-items-center position-relative">
            <div className="kpi-icon bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '42px', height: '42px', fontSize: '18px' }}>
              <i className="bi bi-people"></i>
            </div>
            <div>
              <h6 className="text-muted mb-1 fw-semibold small text-uppercase">PPPoE Clients</h6>
              <h5 className="mb-0 fw-bold text-success">{onlineClients} <span className="fs-6 text-muted fw-normal">/ {totalClients} Online</span></h5>
            </div>
          </div>
        </div>
      </div>

      <div className="col-12 col-sm-6 col-xl-3">
        <div className="card border-0 rounded-4 h-100 kpi-card overflow-hidden bg-body shadow-sm">
          <div className="card-body p-3 d-flex align-items-center position-relative">
            <div className="kpi-icon bg-warning bg-opacity-10 text-warning rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '42px', height: '42px', fontSize: '18px' }}>
              <i className="bi bi-diagram-3"></i>
            </div>
            <div>
              <h6 className="text-muted mb-1 fw-semibold small text-uppercase">Infrastructure</h6>
              <h5 className="mb-0 fw-bold">{odcCount} <span className="fs-6 text-muted fw-normal">ODC</span> | {odpCount} <span className="fs-6 text-muted fw-normal">ODP</span></h5>
            </div>
          </div>
        </div>
      </div>

      <div className="col-12 col-sm-6 col-xl-3">
        <div className="card border-0 rounded-4 h-100 kpi-card overflow-hidden bg-body shadow-sm">
          <div className="card-body p-3 d-flex justify-content-between align-items-center position-relative">
            <div>
              <h6 className="text-muted mb-1 fw-semibold small text-uppercase">Network Health</h6>
              {faultyNodesCount > 0 ? (
                  <h5 className="mb-0 fw-bold text-danger">{faultyNodesCount} <span className="fs-6 fw-normal">Faulty Nodes</span></h5>
              ) : (
                  <h5 className="mb-0 fw-bold" style={{ color: '#10b981' }}>
                      {healthPercentage}% 
                      <span className="fs-6 text-muted fw-normal ms-1">Uptime</span>
                  </h5>
              )}
            </div>
            <div className="gauge-svg ms-2" style={{ width: '48px', height: '48px' }}>
              <svg viewBox="0 0 44 44" className="w-100 h-100" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                <circle cx="22" cy="22" r="18" fill="none" stroke={faultyNodesCount > 0 ? '#ef4444' : '#10b981'} strokeWidth="4" 
                  strokeDasharray={2 * Math.PI * 18} 
                  strokeDashoffset={(2 * Math.PI * 18) - (healthPercentage / 100) * (2 * Math.PI * 18)} 
                  strokeLinecap="round" 
                  style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} 
                />
                <text x="22" y="22" fill={faultyNodesCount > 0 ? '#ef4444' : '#10b981'} fontSize="11" fontWeight="bold" textAnchor="middle" dy=".3em" style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
                  {healthPercentage}
                </text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
