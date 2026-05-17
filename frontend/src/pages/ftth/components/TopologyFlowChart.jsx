import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─────────────────────────────────────────────
   Helper: cek apakah ada user ONLINE di cabang
───────────────────────────────────────────── */
const hasOnlineDescendant = (node) => {
  if (node.type === 'USER') return node.status === 'ONLINE';
  return (node.children || []).some(c => hasOnlineDescendant(c));
};

/* ─────────────────────────────────────────────
   Konfigurasi warna per tipe node
───────────────────────────────────────────── */
const typeConfig = {
  ROUTER:   { color: '#0f172a', bg: '#f8fafc', icon: 'bi-router-fill' },
  OLT_PORT: { color: '#3b82f6', bg: '#eff6ff', icon: 'bi-hdd-rack-fill' },
  ODC:      { color: '#06b6d4', bg: '#ecfeff', icon: 'bi-hdd-network-fill' },
  ODP:      { color: '#f59e0b', bg: '#fffbeb', icon: 'bi-modem-fill' },
  SPLITTER: { color: '#8b5cf6', bg: '#f5f3ff', icon: 'bi-diagram-3-fill' },
  USER:     { color: '#22c55e', bg: '#f0fdf4', icon: 'bi-pc-display-horizontal' },
};

/* ─────────────────────────────────────────────
   Komponen kartu node tunggal
───────────────────────────────────────────── */
const NodeCard = ({ item, onClick }) => {
  const isUserOnline = item.type === 'USER' && item.status === 'ONLINE';
  // isUserOffline is not used
  const hasOnline = item.type !== 'USER' && hasOnlineDescendant(item);

  // Warna border: user mengikuti statusnya sendiri, node lain mengikuti cucu
  let borderColor;
  if (item.type === 'USER') {
    borderColor = isUserOnline ? '#22c55e' : '#ef4444';
  } else {
    const cfg = typeConfig[item.type] || typeConfig.OLT;
    borderColor = cfg.color;
  }

  const cfg = typeConfig[item.type] || typeConfig.OLT;

  return (
    <motion.div
      whileHover={{ scale: 1.06, y: -3 }}
      onClick={() => onClick(item)}
      style={{
        width: item.type === 'USER' ? '120px' : '150px',
        background: '#fff',
        borderRadius: '14px',
        borderTop: `5px solid ${borderColor}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        padding: '10px 12px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Icon */}
      <div style={{ fontSize: '1.4rem', color: borderColor, marginBottom: '4px' }}>
        <i className={`bi ${cfg.icon}`} />
      </div>
      {/* Type Label */}
      <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>
        {item.type}
      </div>
      {/* Name */}
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {item.name}
      </div>
      {/* Port interface name untuk OLT_PORT */}
      {item.type === 'OLT_PORT' && item.port && (
        <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#3b82f6', background: '#eff6ff', borderRadius: '999px', padding: '1px 8px', display: 'inline-block', marginTop: '3px' }}>
          <i className="bi bi-ethernet" /> {item.port}
        </div>
      )}
      {/* Host untuk ROUTER */}
      {item.type === 'ROUTER' && item.host && (
        <div style={{ fontSize: '0.55rem', fontWeight: 600, color: '#64748b', marginTop: '3px' }}>
          {item.host}
        </div>
      )}
      {/* Status pill */}
      <div style={{
        marginTop: '6px',
        fontSize: '0.55rem', fontWeight: 700,
        color: (item.type === 'USER' ? isUserOnline : hasOnline) ? '#16a34a' : '#dc2626',
        background: (item.type === 'USER' ? isUserOnline : hasOnline) ? '#dcfce7' : '#fee2e2',
        borderRadius: '999px', padding: '2px 8px', display: 'inline-block'
      }}>
        {item.type === 'USER'
          ? (isUserOnline ? '● ONLINE' : '● OFFLINE')
          : (hasOnline ? '● ACTIVE' : '● NO SIGNAL')}
      </div>

      {/* Badge nomor port untuk USER */}
      {item.type === 'USER' && item.portNumber !== undefined && (
        <div style={{ marginTop: '4px', fontSize: '0.5rem', fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', borderRadius: '999px', padding: '1px 8px', display: 'inline-block' }}>
          Port #{item.portNumber}
        </div>
      )}

      {/* Badge kapasitas untuk SPLITTER/ODP/ODC */}
      {(item.type === 'ODP' || item.type === 'ODC' || item.type === 'SPLITTER') && item.capacity && (
        <div style={{ marginTop: '4px', fontSize: '0.5rem', fontWeight: 700, color: '#d97706', background: '#fffbeb', borderRadius: '999px', padding: '1px 8px', display: 'inline-block' }}>
          {item.usedPorts}/{item.capacity} port
        </div>
      )}
    </motion.div>
  );
};

/* ─────────────────────────────────────────────
   Komponen pohon rekursif
───────────────────────────────────────────── */
const TreeNode = ({ item, onSelect, isRoot = false }) => {
  const isPathOnline = hasOnlineDescendant(item);
  const lineColor = isPathOnline ? '#22c55e' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <NodeCard item={item} onClick={onSelect} />

      {item.children?.length > 0 && (
        <>
          {/* Garis vertikal turun dari node */}
          <div style={{ width: '3px', height: '36px', background: lineColor, borderRadius: '2px', flexShrink: 0 }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
            {item.children.length > 1 && (
              /* Garis horizontal yang menghubungkan antar anak */
              <div style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: `calc(100% - ${item.type === 'USER' ? '120px' : '150px'})`,
                height: '3px',
                background: lineColor,
                borderRadius: '2px',
              }} />
            )}

            {item.children.map((child, i) => {
              const childOnline = hasOnlineDescendant(child);
              const childLine = childOnline ? '#22c55e' : '#ef4444';
              return (
                <div key={child.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 12px' }}>
                  {/* Garis vertikal dari bracket ke anak */}
                  <div style={{ width: '3px', height: '36px', background: childLine, borderRadius: '2px', flexShrink: 0 }} />
                  <TreeNode item={child} onSelect={onSelect} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   Komponen utama
───────────────────────────────────────────── */
const TopologyFlowChart = ({ nodes, splitters, oltPorts, pppoeUsers, realtimeTopology = [], routers = [], selectedRouter = null }) => {
  const [selectedItem, setSelectedItem] = useState(null);

  /* ── Build Tree Data ── */
  const treeData = useMemo(() => {
    const nodeMap = {};
    nodes.forEach(n => {
      const rt = realtimeTopology.find(r => Number(r.id) === Number(n.id)) || {};
      nodeMap[n.id] = { ...n, status: rt.status || 'UNKNOWN', reason: rt.reason || '' };
    });

    // Fungsi build subtree (ODC -> ODP -> User)
    const buildSubTree = (nodeId) => {
      const node = nodeMap[nodeId];
      if (!node) return null;

      const childNodes = nodes.filter(child =>
        child.incomingLinks?.some(link => Number(link.fromNodeId) === Number(nodeId))
      );
      const subChildren = childNodes.map(c => buildSubTree(c.id)).filter(Boolean);

      let capacity = null;
      let usedPorts = 0;
      let allPorts = [];

      splitters
        .filter(s => Number(s.nodeId) === Number(nodeId))
        .forEach(s => {
          const outputs = s.outputs || [];
          const connectedUsers = pppoeUsers.filter(u =>
            outputs.some(o => o.isUsed === true && Number(o.clientId) === Number(u.id))
          );
          
          const assignedChildNodeIds = new Set(
            outputs.filter(o => o.isUsed && o.targetNodeId).map(o => Number(o.targetNodeId))
          );
          const unassignedChildNodes = childNodes.filter(c => !assignedChildNodeIds.has(Number(c.id)));
          let unassignedIndex = 0;

          allPorts = outputs.map(o => {
            const user = pppoeUsers.find(u => Number(u.id) === Number(o.clientId));
            let targetNode = nodes.find(n => Number(n.id) === Number(o.targetNodeId));
            let isUsed = o.isUsed;

            if (!isUsed && unassignedIndex < unassignedChildNodes.length) {
              targetNode = unassignedChildNodes[unassignedIndex];
              isUsed = true;
              unassignedIndex++;
            }

            const name = user ? user.username : (targetNode ? `[${targetNode.type}] ${targetNode.name}` : (isUsed ? 'Terpakai' : null));
            const isOnline = user ? user.isOnline : (targetNode ? true : false);
            return { 
              portNumber: o.portNumber, 
              isUsed: isUsed, 
              clientId: o.clientId, 
              targetNodeId: targetNode?.id || o.targetNodeId,
              username: name, 
              isOnline: isOnline 
            };
          }).sort((a, b) => a.portNumber - b.portNumber);

          capacity = s.outputPort;
          usedPorts = allPorts.filter(p => p.isUsed).length;

          connectedUsers.forEach(u => {
            const output = outputs.find(o => o.isUsed && Number(o.clientId) === Number(u.id));
            subChildren.push({
              id: `user-${u.id}`,
              name: u.username,
              type: 'USER',
              status: u.isOnline ? 'ONLINE' : 'OFFLINE',
              portNumber: output?.portNumber ?? '-',
              remoteAddress: u.remoteAddress || '-',
              localAddress: u.localAddress || '-',
              profile: u.profile || '-',
              lastSeen: u.lastSeen,
              lastDisconnect: u.lastDisconnect,
              children: [],
            });
          });
        });

      return { 
        ...node, 
        capacity: capacity || node.capacity,
        usedPorts: capacity ? usedPorts : node.usedPorts,
        allPorts: capacity ? allPorts : node.allPorts,
        children: subChildren 
      };
    };

    // Buat tree: Router (root) -> OLT Port -> ODC/ODP/...
    const currentRouter = routers.find(r => Number(r.id) === Number(selectedRouter));
    if (!currentRouter && oltPorts.length === 0) return [];

    const routerNode = {
      id: `router-${currentRouter?.id || 0}`,
      name: currentRouter?.name || currentRouter?.host || 'Mikrotik Router',
      type: 'ROUTER',
      status: 'ONLINE',
      host: currentRouter?.host,
      children: oltPorts.map(port => {
        // Cari node paling atas yang terhubung ke port ini
        const portNodes = nodes.filter(n => Number(n.oltPortId) === Number(port.id));
        const rootNodeChildren = portNodes
          .filter(n => {
            const parentExists = n.incomingLinks?.some(link =>
              nodes.some(p => Number(p.id) === Number(link.fromNodeId))
            );
            return !parentExists;
          })
          .map(n => buildSubTree(n.id))
          .filter(Boolean);

        return {
          id: `port-${port.id}`,
          name: port.name,
          port: port.port,         // nama interface fisik (sfp1, ether1, dll)
          type: 'OLT_PORT',
          status: 'ONLINE',
          latitude: port.latitude,
          longitude: port.longitude,
          children: rootNodeChildren,
        };
      }).filter(p => p.children.length > 0 || oltPorts.length <= 4), // tampilkan semua port jika <= 4
    };

    return [routerNode];
  }, [nodes, splitters, oltPorts, pppoeUsers, realtimeTopology, routers, selectedRouter]);

  /* ── Modal Detail ── */
  const renderDetail = () => {
    if (!selectedItem) return null;
    const isOnline = selectedItem.type === 'USER'
      ? selectedItem.status === 'ONLINE'
      : hasOnlineDescendant(selectedItem);

    const headerBg = isOnline ? '#1e293b' : '#b91c1c';

    return (
      <AnimatePresence>
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setSelectedItem(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <motion.div
            key="modal"
            initial={{ scale: 0.9, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '20px', overflow: 'hidden', width: '100%', maxWidth: '440px', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}
          >
            {/* Header */}
            <div style={{ background: headerBg, color: '#fff', padding: '24px 24px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', opacity: 0.7, marginBottom: '6px' }}>
                {selectedItem.type} — DETAIL
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{selectedItem.name}</div>
              <div style={{ marginTop: '8px' }}>
                <span style={{ background: isOnline ? '#22c55e' : '#ef4444', padding: '3px 12px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700 }}>
                  ● {isOnline ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px 24px' }}>
              <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                <tbody>
                  {/* Field umum */}
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600, width: '45%' }}>Tipe Node</td>
                    <td style={{ padding: '8px 0', fontWeight: 700, color: '#1e293b' }}>{selectedItem.type}</td>
                  </tr>

                  {/* USER specific */}
                  {selectedItem.type === 'USER' && <>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Port Splitter</td>
                      <td style={{ padding: '8px 0', fontWeight: 700, color: '#7c3aed' }}>Port #{selectedItem.portNumber}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Paket (Profile)</td>
                      <td style={{ padding: '8px 0', fontWeight: 700, color: '#2563eb' }}>{selectedItem.profile}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Remote IP</td>
                      <td style={{ padding: '8px 0', fontWeight: 700, fontFamily: 'monospace' }}>{selectedItem.remoteAddress}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Local IP</td>
                      <td style={{ padding: '8px 0', fontWeight: 700, fontFamily: 'monospace' }}>{selectedItem.localAddress}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Last Seen</td>
                      <td style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>
                        {selectedItem.lastSeen ? new Date(selectedItem.lastSeen).toLocaleString('id-ID') : '-'}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Last Disconnect</td>
                      <td style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>
                        {selectedItem.lastDisconnect ? new Date(selectedItem.lastDisconnect).toLocaleString('id-ID') : '-'}
                      </td>
                    </tr>
                  </>}

                  {/* SPLITTER / ODP / ODC specific */}
                  {(selectedItem.type === 'ODP' || selectedItem.type === 'ODC' || selectedItem.type === 'SPLITTER') && selectedItem.capacity && <>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Kapasitas</td>
                      <td style={{ padding: '8px 0', fontWeight: 700 }}>1:{selectedItem.capacity}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Terpakai</td>
                      <td style={{ padding: '8px 0', fontWeight: 700, color: '#d97706' }}>{selectedItem.usedPorts} / {selectedItem.capacity} port</td>
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ padding: '12px 0 4px' }}>
                        <div style={{ fontWeight: 700, color: '#374151', marginBottom: '8px', fontSize: '0.8rem' }}>Peta Port Splitter:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {(selectedItem.allPorts || []).map(p => (
                            <div key={p.portNumber} title={p.username || `Port ${p.portNumber} kosong`} style={{
                              width: '52px', height: '52px', borderRadius: '10px', display: 'flex', flexDirection: 'column',
                              alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700,
                              background: !p.isUsed ? '#f1f5f9' : (p.isOnline ? '#dcfce7' : '#fee2e2'),
                              color: !p.isUsed ? '#94a3b8' : (p.isOnline ? '#16a34a' : '#dc2626'),
                              border: `2px solid ${!p.isUsed ? '#e2e8f0' : (p.isOnline ? '#86efac' : '#fca5a5')}`,
                              cursor: 'default',
                            }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 900 }}>P{p.portNumber}</div>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '46px', textAlign: 'center' }}>
                                {p.isUsed ? p.username : 'Kosong'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  </>}
                  {/* ROUTER specific */}
                  {selectedItem.type === 'ROUTER' && (
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Host / IP</td>
                      <td style={{ padding: '8px 0', fontWeight: 700, fontFamily: 'monospace' }}>{selectedItem.host || '-'}</td>
                    </tr>
                  )}

                  {/* OLT_PORT specific */}
                  {selectedItem.type === 'OLT_PORT' && (
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Interface Port</td>
                      <td style={{ padding: '8px 0', fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace' }}>{selectedItem.port || '-'}</td>
                    </tr>
                  )}

                  {(selectedItem.type === 'ODC' || selectedItem.type === 'ODP') && <>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Latitude</td>
                      <td style={{ padding: '8px 0', fontWeight: 700, fontFamily: 'monospace' }}>{selectedItem.latitude ?? '-'}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Longitude</td>
                      <td style={{ padding: '8px 0', fontWeight: 700, fontFamily: 'monospace' }}>{selectedItem.longitude ?? '-'}</td>
                    </tr>
                    {selectedItem.description && (
                      <tr>
                        <td style={{ padding: '8px 0', color: '#64748b', fontWeight: 600 }}>Keterangan</td>
                        <td style={{ padding: '8px 0', fontWeight: 600 }}>{selectedItem.description}</td>
                      </tr>
                    )}
                  </>}
                </tbody>
              </table>

              <button
                onClick={() => setSelectedItem(null)}
                style={{ marginTop: '20px', width: '100%', background: '#1e293b', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                TUTUP
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  /* ── Render ── */
  return (
    <div style={{ background: '#f8fafc', minHeight: '900px', padding: '40px 20px', fontFamily: "'Inter', system-ui, sans-serif", overflowX: 'auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h2 style={{ fontWeight: 900, fontSize: '1.6rem', color: '#0f172a', marginBottom: '8px' }}>
          LIVE INFRASTRUCTURE MAP
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
          Kabel&nbsp;
          <span style={{ color: '#16a34a', fontWeight: 700 }}>HIJAU</span> = Ada pelanggan online &nbsp;|&nbsp;
          Kabel&nbsp;<span style={{ color: '#dc2626', fontWeight: 700 }}>MERAH</span> = Semua pelanggan offline
        </p>
        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '12px', flexWrap: 'wrap' }}>
          {Object.entries(typeConfig).map(([type, cfg]) => (
            <span key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
              {type}
            </span>
          ))}
        </div>
      </div>

      {/* Tree Canvas */}
      <div style={{ display: 'flex', justifyContent: 'center', minWidth: 'max-content', paddingBottom: '80px' }}>
        {treeData.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '80px 20px' }}>
            <i className="bi bi-broadcast" style={{ fontSize: '3rem', display: 'block', marginBottom: '12px' }} />
            <p>Belum ada data topologi. Pastikan OLT Port sudah dikonfigurasi.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '60px', alignItems: 'flex-start' }}>
            {treeData.map(root => (
              <TreeNode key={root.id} item={root} onSelect={setSelectedItem} isRoot />
            ))}
          </div>
        )}
      </div>

      {renderDetail()}
    </div>
  );
};

export default TopologyFlowChart;
