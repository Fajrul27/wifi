import React, { useState, useEffect } from "react";

// ─────────────────────────────────────────────────
// HELPER: Hitung status node berdasarkan klien
// ─────────────────────────────────────────────────
function calcNodeStatus(node, splitters, realtimeTopology) {
  // Jika ada data realtime dari socket, gunakan itu
  if (realtimeTopology && realtimeTopology.length > 0) {
    const rt = realtimeTopology.find(n => Number(n.id) === Number(node.id));
    if (rt) return { status: rt.status, reason: rt.reason, onlineClients: rt.onlineClients, totalClients: rt.totalClients };
  }

  // Hitung dari splitter outputs
  const nodeSplitters = splitters.filter(s => Number(s.nodeId) === Number(node.id));
  let totalClients = 0;
  nodeSplitters.forEach(s => {
    (s.outputs || []).forEach(o => {
      if (o.isUsed && o.clientId) {
        totalClients++;
      }
    });
  });

  if (totalClients === 0) return { status: "UNKNOWN", reason: "Belum Ada Pelanggan", onlineClients: 0, totalClients: 0 };
  return { status: "ONLINE", reason: "Normal", onlineClients: totalClients, totalClients };
}

function statusConfig(status) {
  switch (status) {
    case "ONLINE":  return { color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0", icon: "●", label: "Online" };
    case "OFFLINE": return { color: "#ef4444", bg: "#fef2f2", border: "#fecaca", icon: "●", label: "Putus!" };
    default:        return { color: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0", icon: "○", label: "Kosong" };
  }
}

// ─────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────
function StatusBadge({ status, reason }) {
  const cfg = statusConfig(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px",
      borderRadius: "20px", background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
    }}>
      <span style={{ fontSize: "0.6rem" }}>{cfg.icon}</span>
      {cfg.label}
      {reason && reason !== "Normal" && <span style={{ fontWeight: 400, opacity: 0.8 }}>· {reason}</span>}
    </span>
  );
}

// ─────────────────────────────────────────────────
// PORT USAGE BAR
// ─────────────────────────────────────────────────
function PortBar({ used, total }) {
  if (total === 0) return <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>–</span>;
  const pct = Math.round((used / total) * 100);
  const color = pct >= 90 ? "#ef4444" : pct >= 60 ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "120px" }}>
      <div style={{ flex: 1, height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "3px", transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: "0.72rem", color: "#64748b", whiteSpace: "nowrap" }}>{used}/{total}</span>
    </div>
  );
}

// SplitterDetail removed in favor of direct NodeCard ports

// ─────────────────────────────────────────────────
// NODE CARD (ODC / ODP)
// ─────────────────────────────────────────────────
function NodeCard({ node, depth, splitters, realtimeTopology, onEdit, onDelete, onAddChild, onAddSplitter, onAssignClient, onUnassignPort, onEditSplitter, onDeleteSplitter, isLastChild, renderTree }) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedPorts, setExpandedPorts] = useState({});
  const togglePort = (portId) => setExpandedPorts(prev => ({ ...prev, [portId]: !prev[portId] }));
  const { status, reason, onlineClients, totalClients } = calcNodeStatus(node, splitters, realtimeTopology);
  const cfg = statusConfig(status);
  const nodeSplitters = splitters.filter(s => Number(s.nodeId) === Number(node.id));
  const totalPorts = nodeSplitters.reduce((a, s) => a + (s.outputs || []).length, 0);
  const usedPorts = nodeSplitters.reduce((a, s) => a + (s.outputs || []).filter(o => o.isUsed).length, 0);

  const isODC = node.type === "ODC";
  const typeColor = isODC ? "#3b82f6" : "#f59e0b";
  const typeBg = isODC ? "#eff6ff" : "#fffbeb";

  const assignedChildNodeIds = new Set();
  nodeSplitters.forEach(s => {
    (s.outputs || []).forEach(o => {
      if (o.targetNodeId) assignedChildNodeIds.add(Number(o.targetNodeId));
      if (o.targetNode) assignedChildNodeIds.add(Number(o.targetNode.id));
    });
  });

  const unassignedChildren = (node.children || []).filter(cn => !assignedChildNodeIds.has(Number(cn.id)));

  return (
    <div style={{ position: "relative", marginLeft: depth > 0 ? "28px" : "0" }}>
      {/* Connector line */}
      {depth > 0 && (
        <div style={{
          position: "absolute", left: "-20px", top: "22px",
          width: "16px", height: "2px",
          background: cfg.color, borderRadius: "2px", opacity: 0.7
        }} />
      )}
      {depth > 0 && !isLastChild && (
        <div style={{
          position: "absolute", left: "-20px", top: "0",
          width: "2px", height: "100%",
          background: "#e2e8f0", borderRadius: "2px"
        }} />
      )}

      {/* Card */}
      <div style={{
        border: `1.5px solid ${status === "OFFLINE" ? "#fca5a5" : status === "ONLINE" ? "#bbf7d0" : "#e2e8f0"}`,
        borderRadius: "10px",
        background: cfg.bg,
        marginBottom: "8px",
        overflow: "hidden",
        boxShadow: status === "OFFLINE" ? "0 0 0 2px #fca5a5" : "0 1px 4px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.2s"
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", cursor: "pointer" }}
          onClick={() => setCollapsed(v => !v)}>

          {/* Collapse icon */}
          <i className={`bi bi-chevron-${collapsed ? "right" : "down"}`}
            style={{ fontSize: "0.7rem", color: "#94a3b8", flexShrink: 0 }} />

          {/* Node type badge */}
          <span style={{
            fontWeight: 700, fontSize: "0.7rem", padding: "2px 8px", borderRadius: "6px",
            background: typeBg, color: typeColor, border: `1px solid ${typeColor}30`, flexShrink: 0
          }}>
            {node.type}
          </span>

          {/* Node name */}
          <span style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.9rem", flex: 1 }}>
            {node.name} {nodeSplitters.length > 0 ? `(${nodeSplitters.map(s => s.type?.replace("SPLITTER_", "").replace("_", ":")).join(", ")})` : ""}
          </span>

          {/* Status badge */}
          <StatusBadge status={status} reason={reason} />

          {/* Port bar */}
          {totalPorts > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
              <i className="bi bi-diagram-3" style={{ fontSize: "0.75rem", color: "#64748b" }} />
              <PortBar used={usedPorts} total={totalPorts} />
            </div>
          )}

          {/* Clients info */}
          {totalClients > 0 && (
            <span style={{ fontSize: "0.72rem", color: "#64748b", flexShrink: 0 }}>
              <i className="bi bi-people me-1" />
              {onlineClients}/{totalClients} online
            </span>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "4px", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            {isODC && (
              <>
                <button title="Add ODC" onClick={() => onAddChild(node.id, "ODC")}
                  style={{ fontSize: "0.7rem", padding: "2px 7px", border: "1px solid #93c5fd", borderRadius: "6px", background: "#eff6ff", color: "#1d4ed8", cursor: "pointer" }}>
                  +ODC
                </button>
                <button title="Add ODP" onClick={() => onAddChild(node.id, "ODP")}
                  style={{ fontSize: "0.7rem", padding: "2px 7px", border: "1px solid #fcd34d", borderRadius: "6px", background: "#fffbeb", color: "#92400e", cursor: "pointer" }}>
                  +ODP
                </button>
              </>
            )}
            <button title="Edit" onClick={() => onEdit(node)}
              style={{ fontSize: "0.7rem", padding: "2px 7px", border: "1px solid #d1d5db", borderRadius: "6px", background: "#f9fafb", color: "#374151", cursor: "pointer" }}>
              <i className="bi bi-pencil" />
            </button>
            <button title="Delete" onClick={() => onDelete(node.id)}
              style={{ fontSize: "0.7rem", padding: "2px 7px", border: "1px solid #fca5a5", borderRadius: "6px", background: "#fff1f2", color: "#dc2626", cursor: "pointer" }}>
              <i className="bi bi-trash" />
            </button>
          </div>
        </div>

        {/* Splitter ports directly inside NodeCard */}
        {!collapsed && nodeSplitters.length > 0 && (
          <div style={{ padding: "0 14px 12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px", borderTop: "1px solid #e2e8f0", paddingTop: "10px" }}>
              {nodeSplitters.flatMap((s, sIdx) => 
                (s.outputs || []).map(o => {
                  const childNode = (node.children || []).find(cn => Number(cn.id) === Number(o.targetNodeId) || (o.targetNode && Number(cn.id) === Number(o.targetNode.id)));
                  const isPortExpanded = !!expandedPorts[o.id];
                  const portLabel = nodeSplitters.length > 1 ? `S${sIdx+1}-#${o.portNumber}` : `#${o.portNumber}`;

                  return (
                    <div key={o.id} style={{
                      display: "flex", flexDirection: "column", gap: "6px", padding: "6px 10px",
                      borderRadius: "6px", fontSize: "0.75rem",
                      background: o.isUsed ? "#f0fdf4" : "#f8fafc",
                      border: `1px solid ${o.isUsed ? "#bbf7d0" : "#e2e8f0"}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "nowrap" }}>
                        <span style={{ fontWeight: 700, color: "#64748b", minWidth: "22px", flexShrink: 0 }}>{portLabel}</span>
                        {o.isUsed ? (
                          <>
                            {childNode || o.targetNode ? (
                              <>
                                <i className="bi bi-diagram-2-fill text-primary" style={{ flexShrink: 0 }} />
                                <div 
                                  onClick={() => togglePort(o.id)}
                                  style={{ color: "#1d4ed8", fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", minWidth: 0 }}
                                >
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{childNode?.name || o.targetNode?.name}</span>
                                  <i className={`bi bi-chevron-${isPortExpanded ? "up" : "down"} text-muted`} style={{ fontSize: "0.65rem", flexShrink: 0 }} />
                                </div>
                                <span style={{
                                  fontSize: "0.65rem", padding: "1px 6px", borderRadius: "10px",
                                  background: "#eff6ff", color: "#1d4ed8", fontWeight: 600, flexShrink: 0
                                }}>
                                  {childNode?.type || o.targetNode?.type || "NODE"}
                                </span>
                              </>
                            ) : ( o.client ? (
                              <>
                                <i className="bi bi-person-fill text-success" style={{ flexShrink: 0 }} />
                                <span style={{ color: "#166534", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                                  {o.client.username}
                                </span>
                                <span style={{
                                  fontSize: "0.65rem", padding: "1px 5px", borderRadius: "10px",
                                  background: o.client.isOnline ? "#dcfce7" : "#fee2e2",
                                  color: o.client.isOnline ? "#15803d" : "#dc2626", fontWeight: 600, flexShrink: 0
                                }}>
                                  {o.client.isOnline ? "ON" : "OFF"}
                                </span>
                              </>
                            ) : (
                              <>
                                <i className="bi bi-check-circle-fill text-success" style={{ flexShrink: 0 }} />
                                <span style={{ color: "#166534", fontWeight: 500, flex: 1, minWidth: 0 }}>Terpakai</span>
                              </>
                            ))}
                            <button
                              title="Putuskan Jalur (Unassign)"
                              onClick={() => onUnassignPort && onUnassignPort(o.id)}
                              style={{ fontSize: "0.65rem", padding: "1px 6px", border: "1px solid #fca5a5", borderRadius: "8px", background: "#fff1f2", color: "#dc2626", cursor: "pointer", marginLeft: "auto", flexShrink: 0, display: "flex", alignItems: "center", gap: "4px" }}
                            >
                              <i className="bi bi-x-circle" /> Putuskan
                            </button>
                          </>
                        ) : (
                          <>
                            <i className="bi bi-dash-circle text-secondary" />
                            <span style={{ color: "#94a3b8", flex: 1 }}>Kosong</span>
                            <button
                              onClick={() => onAssignClient && onAssignClient(o.id)}
                              style={{ fontSize: "0.65rem", padding: "1px 6px", border: "1px solid #93c5fd", borderRadius: "8px", background: "#eff6ff", color: "#1d4ed8", cursor: "pointer" }}
                            >
                              + Assign
                            </button>
                          </>
                        )}
                      </div>

                      {isPortExpanded && (childNode ? (
                        <div style={{ marginTop: "6px", paddingTop: "8px", borderTop: "1px dashed #cbd5e1", paddingLeft: "12px" }}>
                          {renderTree([childNode], depth + 1)}
                        </div>
                      ) : o.targetNode ? (
                        <div style={{ marginTop: "6px", paddingTop: "8px", borderTop: "1px dashed #cbd5e1", paddingLeft: "12px" }}>
                          {renderTree([{ ...o.targetNode, children: [] }], depth + 1)}
                        </div>
                      ) : null)}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Location */}
        {!collapsed && node.latitude && node.longitude && (
          <div style={{ padding: "4px 14px 8px", fontSize: "0.72rem", color: "#64748b" }}>
            <a href={`https://maps.google.com/?q=${node.latitude},${node.longitude}`}
              target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6", textDecoration: "none" }}>
              <i className="bi bi-geo-alt me-1" />
              {parseFloat(node.latitude).toFixed(5)}, {parseFloat(node.longitude).toFixed(5)}
            </a>
          </div>
        )}
      </div>

      {/* Children (rekursif) */}
      {!collapsed && unassignedChildren.length > 0 && (
        <div style={{ position: "relative" }}>
          <div style={{
            position: "absolute", left: "8px", top: "-4px", bottom: "24px",
            width: "2px", background: cfg.color, opacity: 0.3, borderRadius: "2px"
          }} />
          {renderTree(unassignedChildren, depth + 1)}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────
export default function TopologyTreeView({
  nodes, splitters, oltPorts, realtimeTopology = [],
  onEdit, onDelete, onAddChild, onAddSplitter, onAssignClient, onUnassignPort, onEditSplitter, onDeleteSplitter
}) {
  const [socketStatus, setSocketStatus] = useState(realtimeTopology);

  useEffect(() => {
    setSocketStatus(realtimeTopology);
  }, [realtimeTopology]);

  // Bangun struktur tree
  const buildTree = (nodes) => {
    const byId = {};
    nodes.forEach(n => byId[n.id] = { ...n, children: [] });

    const roots = [];
    nodes.forEach(n => {
      let parentNodeId = null;
      const parentLink = (n.incomingLinks || [])[0];
      if (parentLink) {
        parentNodeId = parentLink.fromNodeId;
      } else {
        for (const s of splitters) {
          const foundOut = (s.outputs || []).find(o => Number(o.targetNodeId) === Number(n.id));
          if (foundOut) { parentNodeId = s.nodeId; break; }
        }
      }

      if (parentNodeId && byId[parentNodeId]) {
        byId[parentNodeId].children.push(byId[n.id]);
      } else {
        roots.push(byId[n.id]);
      }
    });

    return roots;
  };

  const renderTree = (nodeList, depth = 0) => {
    return nodeList.map((node, idx) => (
      <NodeCard
        key={node.id}
        node={node}
        depth={depth}
        isLastChild={idx === nodeList.length - 1}
        splitters={splitters}
        realtimeTopology={socketStatus}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddChild={onAddChild}
        onAddSplitter={onAddSplitter}
        onAssignClient={onAssignClient}
        onUnassignPort={onUnassignPort}
        onEditSplitter={onEditSplitter}
        onDeleteSplitter={onDeleteSplitter}
        renderTree={renderTree}
      />
    ));
  };

  const tree = buildTree(nodes);

  // Hitung statistik ringkasan
  const offlineNodes = nodes.filter(n => {
    const rt = socketStatus.find(r => Number(r.id) === Number(n.id));
    return rt?.status === "OFFLINE";
  });

  if (nodes.length === 0) {
    return (
      <div className="text-center py-5 text-muted">
        <i className="bi bi-diagram-2 fs-1 d-block mb-3 text-secondary" />
        <p className="mb-3">Belum ada Topology Node</p>
        <button className="btn btn-success" onClick={() => onEdit(null)}>
          <i className="bi bi-plus-lg me-1" /> Buat Node Pertama
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Alert jika ada node offline */}
      {offlineNodes.length > 0 && (
        <div style={{
          marginBottom: "16px", padding: "12px 16px", borderRadius: "10px",
          background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626",
          display: "flex", alignItems: "flex-start", gap: "10px"
        }}>
          <i className="bi bi-exclamation-triangle-fill" style={{ marginTop: "2px", flexShrink: 0 }} />
          <div>
            <strong>⚠️ {offlineNodes.length} node terdeteksi OFFLINE</strong>
            <div style={{ fontSize: "0.8rem", marginTop: "4px", opacity: 0.85 }}>
              {offlineNodes.map(n => {
                const rt = socketStatus.find(r => Number(r.id) === Number(n.id));
                return <span key={n.id} style={{ display: "inline-block", marginRight: "12px" }}>
                  <strong>{n.name}</strong>: {rt?.reason || "–"}
                </span>;
              })}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "12px", fontSize: "0.78rem", color: "#64748b", flexWrap: "wrap" }}>
        <span>⬤ <span style={{ color: "#22c55e" }}>Online</span></span>
        <span>⬤ <span style={{ color: "#ef4444" }}>Offline/Putus</span></span>
        <span>○ <span style={{ color: "#94a3b8" }}>Belum ada pelanggan</span></span>
        <span style={{ marginLeft: "auto" }}>
          <i className="bi bi-diagram-3 me-1" /> Klik splitter untuk lihat detail port
        </span>
      </div>

      {/* OLT Ports sebagai root */}
      {oltPorts.map(port => {
        const portNodes = tree.filter(n => Number(n.oltPortId) === Number(port.id));
        if (portNodes.length === 0) return null;
        return (
          <div key={port.id} style={{ marginBottom: "20px" }}>
            {/* OLT Port header */}
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "8px 14px", borderRadius: "10px",
              background: "linear-gradient(135deg, #1e293b, #334155)",
              color: "#fff", marginBottom: "10px"
            }}>
              <i className="bi bi-hdd-rack-fill" style={{ color: "#38bdf8" }} />
              <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>OLT: {port.name}</span>
              <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>• {port.port}</span>
              <span style={{ marginLeft: "auto", fontSize: "0.75rem", background: "#ffffff20", padding: "2px 8px", borderRadius: "20px" }}>
                {portNodes.length} ODC terhubung
              </span>
            </div>

            {/* Nodes */}
            <div style={{ paddingLeft: "8px" }}>
              {renderTree(portNodes, 0)}
            </div>
          </div>
        );
      })}

      {/* Nodes tanpa OLT Port (orphan) */}
      {(() => {
        const orphans = tree.filter(n => !n.oltPortId);
        if (orphans.length === 0) return null;
        return (
          <div>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "8px" }}>
              <i className="bi bi-question-circle me-1" /> Node tanpa OLT Port
            </div>
            {renderTree(orphans, 0)}
          </div>
        );
      })()}
    </div>
  );
}
