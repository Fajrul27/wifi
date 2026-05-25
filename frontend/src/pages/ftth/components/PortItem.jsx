import { useState, useEffect } from "react";
import api from "../../../services/api";

// =========================
// ODC TREE ITEM (FLAT + SAFE RECURSION OPTIONAL)
// =========================
const OdcTreeItem = ({
  odc,
  level = 0,
  onCreateChildOdc,
  onCreateOdp,
  onManageOdp
}) => {
  const [expanded, setExpanded] = useState(true);

  const usedPorts = odc.ports?.filter(p => p.isUsed).length || 0;
  const totalPorts = odc.ports?.length || 0;

  return (
    <div
      className={`ms-${level * 3} mt-2`}
      style={{
        borderLeft: level > 0 ? "2px dashed #dee2e6" : "none",
        paddingLeft: level > 0 ? "12px" : "0"
      }}
    >
      <div className="card border-0 shadow-sm mb-2" style={{ fontSize: "0.85rem" }}>

        {/* HEADER */}
        <div
          className="card-header py-2 px-3 d-flex justify-content-between align-items-center"
          style={{ background: "var(--bs-primary-bg-subtle)", cursor: "pointer" }}
          onClick={() => setExpanded(!expanded)}
        >
          <div className="d-flex align-items-center gap-2">
            <i className={`bi bi-${expanded ? "dash-square" : "plus-square"} text-primary`} />

            <span className="fw-semibold text-primary">
              {odc.name}
            </span>

            <span className="badge bg-primary-subtle text-primary">
              {odc.splitRatio?.replace("ONE_TO_", "1:")}
            </span>

            <small className="text-muted">
              {usedPorts}/{totalPorts}
            </small>
          </div>

          <div className="d-flex gap-1">
            <button
              className="btn btn-sm btn-outline-success"
              onClick={(e) => {
                e.stopPropagation();
                onCreateChildOdc?.(odc);
              }}
            >
              <i className="bi bi-diagram-3-fill" />
            </button>

            <button
              className="btn btn-sm btn-outline-info"
              onClick={(e) => {
                e.stopPropagation();
                onCreateOdp?.(odc);
              }}
            >
              <i className="bi bi-boxes" />
            </button>
          </div>
        </div>

        {/* BODY */}
        {expanded && (
          <div className="card-body py-2 px-3">

            {/* PORTS */}
            <div className="d-flex flex-wrap gap-1">
              {odc.ports?.map(port => (
                <span
                  key={port.id}
                  className={`badge py-1 px-2 ${
                    port.isUsed
                      ? "bg-success-subtle text-success border"
                      : "bg-light text-muted border"
                  }`}
                  style={{ fontSize: "0.75rem" }}
                >
                  <i className={`bi bi-${port.isUsed ? "box-seam" : "circle"}`} />
                  {" "}#{port.index}
                </span>
              ))}
            </div>

            {/* ODP */}
            {odc.odps?.length > 0 && (
              <div className="mt-2 border-top pt-2">
                <small className="text-muted fw-semibold">ODP:</small>

                <div className="d-flex flex-wrap gap-1 mt-1">
                  {odc.odps.map(odp => (
                    <span
                      key={odp.id}
                      className="badge bg-info-subtle text-info border"
                      style={{ cursor: "pointer", fontSize: "0.75rem" }}
                      onClick={() => onManageOdp?.(odp.id)}
                    >
                      {odp.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

// =========================
// MAIN PORT ITEM
// =========================
export default function PortItem({
  port,
  olt,
  onCreateOdc,
  onCreateOdp,
  onManageOdp,
  onDelete,
  loading
}) {
  const [expanded, setExpanded] = useState(false);
  const [odcTree, setOdcTree] = useState([]);
  const [loadingTree, setLoadingTree] = useState(false);

  const isUsed = port?._count?.odcs > 0 || port?._count?.nodes > 0;

  useEffect(() => {
    if (expanded) fetchTree();
  }, [expanded]);

  // =========================
  // FIXED FETCH (BASED ON YOUR REAL RESPONSE)
  // =========================
const fetchTree = async () => {
  setLoadingTree(true);

  try {
    const oltId = olt?.id;

    if (!oltId) {
      setOdcTree([]);
      return;
    }

    const res = await api.get(`/olts/olt/${oltId}`);

    const ports = res.data?.data?.ports ?? [];

    // 🔥 CARI PORT YANG SESUAI DENGAN PORT INI
    const currentPort = ports.find(p => p.id === port.id);

    const odcs = currentPort?.odcs ?? [];

    setOdcTree(odcs);

  } catch (err) {
    console.error(err);
    setOdcTree([]);
  } finally {
    setLoadingTree(false);
  }
};

  return (
    <div className="border rounded-3 mb-2 bg-white">

      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center p-2 px-3">

        <div className="d-flex align-items-center gap-2">
          <i className={`bi bi-${isUsed ? "plug-fill text-primary" : "plug text-muted"}`} />

          <span className={`small fw-medium ${isUsed ? "text-primary" : "text-muted"}`}>
            PORT {port?.index}
          </span>

          {isUsed && (
            <span className="badge bg-primary-subtle text-primary">
              Terpakai
            </span>
          )}
        </div>

        <div className="d-flex gap-1">

          <button
            className="btn btn-sm btn-outline-success"
            onClick={() => onCreateOdc?.(port, olt)}
            disabled={loading}
          >
            <i className="bi bi-diagram-3" />
          </button>

          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setExpanded(!expanded)}
          >
            <i className={`bi bi-chevron-${expanded ? "up" : "down"}`} />
          </button>

          {!isUsed && (
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={() => onDelete?.()}
            >
              <i className="bi bi-trash" />
            </button>
          )}

        </div>
      </div>

      {/* TREE */}
      {expanded && (
        <div className="border-top p-2 bg-light-subtle">

          {loadingTree ? (
            <small className="text-muted">Loading...</small>
          ) : odcTree.length === 0 ? (
            <div className="text-center py-2">
              <small className="text-muted">Belum ada ODC</small>
            </div>
          ) : (
            odcTree.map(odc => (
              <OdcTreeItem
                key={odc.id}
                odc={odc}
                onCreateChildOdc={onCreateOdc}
                onCreateOdp={onCreateOdp}
                onManageOdp={onManageOdp}
              />
            ))
          )}

        </div>
      )}
    </div>
  );
}