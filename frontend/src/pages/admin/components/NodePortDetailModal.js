import React, { useState, useEffect } from 'react';
import api from '../../../services/api';

const NodePortDetailModal = ({
  show,
  onClose,
  node,
  isDarkMode,
  nodes = [],
  oltPorts = [],
  pppoeUsers = [],
  onNavigateToEntity
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const isRouterOrOlt = node?.type === 'Router' || node?.type === 'oltPort';
  const isRouter = node?.type === 'Router';

  useEffect(() => {
    if (show && node) {
      if (isRouterOrOlt) {
        setError(null);
        setLoading(true);
        try {
          if (node.type === 'Router') {
            // ── Router: group all OLT ports by OLT device name ──────────────
            const ports = oltPorts.filter(p => Number(p.routerId) === Number(node.id));

            // Group by oltName
            const groupMap = {};
            ports.forEach(p => {
              const oltName = p.oltName || (p.name ? p.name.split(' - Port ')[0] : 'OLT Device');
              if (!groupMap[oltName]) groupMap[oltName] = [];
              groupMap[oltName].push(p);
            });

            const groupedPorts = Object.keys(groupMap).map(oltName => {
              const sorted = [...groupMap[oltName]].sort(
                (a, b) => Number(a.portNumber || a.index || 0) - Number(b.portNumber || b.index || 0)
              );
              const mapped = sorted.map(p => {
                const connectedOdcs = nodes.filter(
                  n => n.type === 'ODC' && Number(n.oltPortId) === Number(p.id)
                );
                return {
                  id: p.id,
                  index: p.portNumber || p.index || p.port?.replace('PON ', '') || '—',
                  name: p.name,
                  isUsed: connectedOdcs.length > 0,
                  connectedOdcs
                };
              });
              return { oltName, ports: mapped };
            });

            // Overall stats
            let totalPorts = 0;
            let usedPorts = 0;
            groupedPorts.forEach(g => {
              totalPorts += g.ports.length;
              usedPorts += g.ports.filter(p => p.isUsed).length;
            });

            setData({ groupedPorts, totalPorts, usedPorts });
          } else {
            // ── OLT Port: flat list of all ports of the same OLT ────────────
            const currentOltName = node.oltName || (node.name ? node.name.split(' - Port ')[0] : '');
            const ports = oltPorts.filter(p => {
              const pOltName = p.oltName || (p.name ? p.name.split(' - Port ')[0] : '');
              return pOltName === currentOltName;
            });
            const sortedPorts = [...ports].sort(
              (a, b) => Number(a.portNumber || a.index || 0) - Number(b.portNumber || b.index || 0)
            );
            const mappedPorts = sortedPorts.map(p => {
              const connectedOdcs = nodes.filter(
                n => n.type === 'ODC' && Number(n.oltPortId) === Number(p.id)
              );
              return {
                id: p.id,
                index: p.portNumber || p.index || p.port?.replace('PON ', '') || '—',
                name: p.name,
                isUsed: connectedOdcs.length > 0,
                connectedOdcs
              };
            });
            setData({ ports: mappedPorts });
          }
        } catch (err) {
          setError(err.message || 'Gagal memproses data port');
        } finally {
          setLoading(false);
        }
      } else {
        fetchPortDetails();
      }
    } else {
      setData(null);
      setError(null);
    }
  }, [show, node]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPortDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const type = node.type === 'ODP' ? 'odp' : 'odc';
      const realId = node.id >= 100000 && node.type === 'ODP' ? node.id - 100000 : node.id;
      const res = await api.get(`/topology/${type}/${realId}`);
      if (res.data?.success) {
        setData(res.data.data);
      } else {
        setError(res.data?.message || 'Gagal memuat data port');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Gagal memuat data port');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  // ── Stats for non-router nodes ───────────────────────────────────────────────
  const totalPorts = isRouter
    ? (data?.totalPorts ?? 0)
    : (data?.ports?.length ?? 0);
  const usedPorts  = isRouter
    ? (data?.usedPorts ?? 0)
    : (data?.ports?.filter(p => p.isUsed).length ?? 0);
  const freePorts  = totalPorts - usedPorts;

  // ── Port card renderer ───────────────────────────────────────────────────────
  const renderPortCard = (port) => {
    const isPortUsed = port.isUsed;
    return (
      <div key={port.id || port.index} className="col-12 col-sm-6 col-md-4 col-lg-3">
        <div
          className={`card h-100 border ${
            isPortUsed
              ? (isDarkMode
                  ? 'bg-primary-subtle border-primary-subtle text-white'
                  : 'bg-primary-subtle bg-opacity-25 border-primary-subtle')
              : (isDarkMode ? 'bg-dark border-secondary' : 'bg-white border-light-subtle')
          }`}
          style={{ borderRadius: '12px', transition: 'all 0.2s' }}
        >
          <div className="p-3 d-flex flex-column h-100 justify-content-between">
            {/* Port header */}
            <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom border-light-subtle">
              <span className="fw-bold" style={{ fontSize: '13px' }}>Port #{port.index}</span>
              <span
                className={`badge ${isPortUsed ? 'bg-primary' : 'bg-secondary'} px-2 py-1`}
                style={{ fontSize: '10px' }}
              >
                {isPortUsed ? 'Terisi' : 'Kosong'}
              </span>
            </div>

            {/* Port body */}
            <div className="flex-grow-1 d-flex flex-column justify-content-center">
              {isPortUsed ? (
                isRouterOrOlt ? (
                  // Router / OLT Port → shows connected ODCs (click → navigate to ODC)
                  <div style={{ fontSize: '11px' }}>
                    <div className="text-muted mb-1">Connected to ODC:</div>
                    <div className="d-flex flex-column gap-1">
                      {port.connectedOdcs?.map(odc => (
                        <div
                          key={odc.id}
                          className="fw-bold text-truncate text-primary"
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => onNavigateToEntity && onNavigateToEntity(odc.id, 'node')}
                          title={`Klik untuk menuju ke ${odc.name}`}
                        >
                          <i className="bi bi-diagram-3-fill me-1"></i> {odc.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : node.type === 'ODP' ? (
                  // ODP port → shows connected PPPoE user (click → navigate to client)
                  <div style={{ fontSize: '11px' }}>
                    <div className="text-muted mb-1">User connected:</div>
                    <div
                      className="fw-bold text-truncate text-primary"
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() =>
                        onNavigateToEntity &&
                        onNavigateToEntity(port.user?.id || port.user?.username, 'client')
                      }
                      title={`Klik untuk menuju ke detail ${port.user?.username || '—'}`}
                    >
                      <i className="bi bi-person-fill me-1"></i> {port.user?.username || '—'}
                    </div>
                    <div className="mt-1 d-flex align-items-center gap-1">
                      <span
                        className="rounded-circle d-inline-block"
                        style={{
                          width: '8px',
                          height: '8px',
                          background: port.user?.isOnline ? '#10b981' : '#ef4444'
                        }}
                      ></span>
                      <span className="text-muted" style={{ fontSize: '10px' }}>
                        {port.user?.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                ) : (
                  // ODC port → shows connected ODP or child ODC (click → navigate to node)
                  <div style={{ fontSize: '11px' }}>
                    <div className="text-muted mb-1">Connected to:</div>
                    <div
                      className="fw-bold text-truncate text-primary"
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => {
                        console.log('[NodePortDetailModal] Clicked connection:', {
                          connectedOdpId: port.connectedOdpId,
                          connectedOdcId: port.connectedOdcId,
                          connectionType: port.connectionType,
                          connectionName: port.connectionName,
                          idPassed: port.connectedOdpId || port.connectedOdcId
                        });
                        onNavigateToEntity &&
                        onNavigateToEntity(
                          port.connectedOdpId || port.connectedOdcId,
                          'node'
                        );
                      }}
                      title={`Klik untuk menuju ke detail ${port.connectionName || '—'}`}
                    >
                      <i
                        className={`bi ${
                          port.connectionType === 'ODP'
                            ? 'bi-boxes text-info'
                            : 'bi-diagram-3-fill text-primary'
                        } me-1`}
                      ></i>
                      {port.connectionName ||
                        `${port.connectionType} #${port.connectedOdpId || port.connectedOdcId}`}
                    </div>
                    <div className="text-muted mt-1" style={{ fontSize: '10px' }}>
                      Type:{' '}
                      <span className="badge bg-light text-dark border">
                        {port.connectionType}
                      </span>
                    </div>
                  </div>
                )
              ) : (
                <div
                  className="text-center py-2 text-muted"
                  style={{ fontSize: '11px', fontStyle: 'italic' }}
                >
                  Port Tersedia
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="modal-backdrop-custom d-flex align-items-center justify-content-center"
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(8px)',
        zIndex: 10070
      }}
    >
      <div
        className={`card border shadow-lg ${isDarkMode ? 'bg-dark text-white border-secondary' : 'bg-white text-dark'}`}
        style={{
          width: '90%',
          maxWidth: '850px',
          maxHeight: '85vh',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          className={`p-4 border-bottom d-flex align-items-center justify-content-between ${
            isDarkMode ? 'border-secondary bg-dark-subtle' : 'border-light bg-light'
          }`}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center text-white"
              style={{
                width: '40px', height: '40px',
                background:
                  node?.type === 'ODP' ? '#06b6d4' :
                  node?.type === 'Router' ? '#3b82f6' :
                  node?.type === 'oltPort' ? '#a855f7' : '#10b981',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              <i
                className={`bi ${
                  node?.type === 'ODP' ? 'bi-boxes' :
                  node?.type === 'Router' ? 'bi-router' :
                  node?.type === 'oltPort' ? 'bi-hdd-network' : 'bi-diagram-3-fill'
                }`}
                style={{ fontSize: '1.2rem' }}
              ></i>
            </div>
            <div>
              <h5 className="mb-0 fw-bold">
                {node?.type === 'oltPort'
                  ? (node.oltName || (node.name ? node.name.split(' - Port ')[0] : 'OLT Device'))
                  : (node?.name || 'Detail Port')}
              </h5>
              <span
                className="badge mt-1"
                style={{
                  fontSize: '0.75rem',
                  backgroundColor:
                    node?.type === 'ODP' ? '#06b6d4' :
                    node?.type === 'Router' ? '#3b82f6' :
                    node?.type === 'oltPort' ? '#a855f7' : '#10b981',
                  color: '#fff'
                }}
              >
                {node?.type === 'oltPort' ? 'OLT' : node?.type}
              </span>
            </div>
          </div>
          <button
            className="btn btn-sm btn-outline-secondary"
            style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
            onClick={onClose}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-auto flex-grow-1">
          {loading && (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <div className="mt-2 text-muted">Memuat informasi port...</div>
            </div>
          )}

          {error && !loading && (
            <div className="alert alert-danger rounded-4">
              <i className="bi bi-exclamation-triangle me-2"></i> {error}
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Stats row */}
              <div className="row g-3 mb-4">
                <div className="col-4">
                  <div className={`p-3 rounded-4 border text-center ${isDarkMode ? 'bg-dark-subtle border-secondary' : 'bg-light border-light'}`}>
                    <small className="text-muted d-block mb-1">Total Port</small>
                    <h3 className="mb-0 fw-bold">{totalPorts}</h3>
                  </div>
                </div>
                <div className="col-4">
                  <div className={`p-3 rounded-4 border text-center ${isDarkMode ? 'bg-dark-subtle border-secondary' : 'bg-light border-light'}`}>
                    <small className="text-muted d-block mb-1">Port Terisi</small>
                    <h3 className="mb-0 fw-bold text-primary">{usedPorts}</h3>
                  </div>
                </div>
                <div className="col-4">
                  <div className={`p-3 rounded-4 border text-center ${isDarkMode ? 'bg-dark-subtle border-secondary' : 'bg-light border-light'}`}>
                    <small className="text-muted d-block mb-1">Port Kosong</small>
                    <h3 className="mb-0 fw-bold text-success">{freePorts}</h3>
                  </div>
                </div>
              </div>

              {/* ── Router: grouped by OLT device ─────────────────────────── */}
              {isRouter && data.groupedPorts ? (
                data.groupedPorts.length > 0 ? (
                  data.groupedPorts.map((group, gIdx) => (
                    <div key={gIdx} className="mb-4">
                      <h6
                        className={`fw-bold mb-3 d-flex align-items-center gap-2 pb-2 border-bottom ${
                          isDarkMode ? 'border-secondary text-info' : 'text-primary border-primary-subtle'
                        }`}
                      >
                        <i className="bi bi-hdd-network-fill"></i>
                        {group.oltName}
                        <span className="badge bg-secondary ms-1" style={{ fontSize: '10px' }}>
                          {group.ports.filter(p => p.isUsed).length}/{group.ports.length} terisi
                        </span>
                      </h6>
                      {group.ports.length > 0 ? (
                        <div className="row g-3">
                          {group.ports.map(port => renderPortCard(port))}
                        </div>
                      ) : (
                        <div className="text-center py-3 text-muted border rounded-4" style={{ borderStyle: 'dashed' }}>
                          Tidak ada port pada OLT ini.
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted border rounded-4" style={{ borderStyle: 'dashed' }}>
                    Tidak ada OLT/port yang terkonfigurasi untuk router ini.
                  </div>
                )
              ) : (
                /* ── OLT Port / ODC / ODP: flat port grid ──────────────── */
                <>
                  <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                    <i className="bi bi-grid-3x3-gap-fill text-muted"></i> Peta Port Perangkat
                  </h6>
                  {data.ports && data.ports.length > 0 ? (
                    <div className="row g-3">
                      {data.ports.map(port => renderPortCard(port))}
                    </div>
                  ) : (
                    <div
                      className="text-center py-4 text-muted border rounded-4"
                      style={{ borderStyle: 'dashed' }}
                    >
                      Tidak ada port yang terkonfigurasi.
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {!loading && !error && !data && (
            <div className="text-center py-4 text-muted">Tidak ada data.</div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`p-3 border-top text-end ${
            isDarkMode ? 'border-secondary bg-dark-subtle' : 'border-light bg-light'
          }`}
        >
          <button
            className="btn btn-secondary px-4"
            style={{ borderRadius: '8px' }}
            onClick={onClose}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default NodePortDetailModal;
