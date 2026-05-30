import React from 'react';

export default function DashboardSystemLogs({ eventLogs }) {
  return (
    <div className="card border-0 rounded-4 overflow-hidden d-flex flex-column bg-body shadow-sm" style={{ flex: 1, minHeight: 0 }}>
      <div className="card-header bg-transparent border-bottom-0 pt-4 pb-2 px-4 d-flex justify-content-between align-items-center flex-shrink-0">
        <h6 className="fw-bold text-body-emphasis mb-0 d-flex align-items-center gap-2">
          <i className="bi bi-activity text-danger"></i> System Activity
        </h6>
        {eventLogs.length > 0 && (
          <span className="badge bg-danger rounded-pill pulse-badge" style={{ width: '8px', height: '8px', padding: 0 }}></span>
        )}
      </div>
      <div className="card-body p-0 overflow-auto flex-grow-1 custom-scrollbar" style={{ minHeight: 0 }}>
          <div className="list-group list-group-flush">
              {eventLogs.length === 0 ? (
                  <div className="p-4 text-center text-muted small">No recent activity</div>
              ) : (
                  eventLogs.map(log => (
                      <div key={log.id} className="list-group-item border-0 px-4 py-3 d-flex align-items-start gap-3 hover-bg-light transition-all">
                          <div className={`rounded-circle p-2 bg-${log.type} bg-opacity-10 text-${log.type} mt-1 flex-shrink-0`} style={{ fontSize: '14px', lineHeight: 1 }}>
                              <i className={`bi ${log.type === 'success' ? 'bi-check-circle-fill' : log.type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'}`}></i>
                          </div>
                          <div>
                              <p className="mb-1 small fw-medium text-body-emphasis">{log.message}</p>
                              <small className="text-muted" style={{ fontSize: '11px' }}>
                                {log.time instanceof Date && !isNaN(log.time) ? log.time.toLocaleTimeString() : new Date(log.time).toLocaleTimeString()}
                              </small>
                          </div>
                      </div>
                  ))
              )}
          </div>
      </div>
    </div>
  );
}
