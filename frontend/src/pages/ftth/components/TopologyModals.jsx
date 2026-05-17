import React from "react";
import MapPicker from "../../../components/MapPicker";

export default function TopologyModals({
  showModal,
  modalType,
  modalData,
  closeModal,
  submitting,
  routers,
  filteredOltPorts,
  nodes,
  splitters,
  availableUsers,
  pppoeUsers,
  oltPortForm,
  setOltPortForm,
  nodeForm,
  setNodeForm,
  splitterForm,
  setSplitterForm,
  userForm,
  setUserForm,
  assignForm,
  setAssignForm,
  submitOltPort,
  submitNode,
  submitSplitter,
  handleUpdateUser,
  submitAssign,
  clientDropdownOpen,
  setClientDropdownOpen,
  userSearch,
  setUserSearch,
  SPLITTER_TYPES,
  CABLE_TYPES,
  getSplitterLabel,
  getCableLabel,
  getDistance,
  setModalData,
  openModal,
}) {
  if (!showModal) return null;

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 1050 }} onClick={closeModal}>
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white" style={{ maxHeight: "90vh" }}>
          <div className="modal-header bg-light py-3 px-4 border-bottom border-secondary-subtle d-flex align-items-center justify-content-between">
            <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2 fs-5">
              <div className="bg-primary bg-opacity-10 text-primary p-2 rounded-3 d-flex align-items-center justify-content-center">
                <i className={`bi bi-${modalType === 'oltPort' ? 'hdd-stack' : modalType === 'node' ? 'diagram-2' : modalType === 'splitter' ? 'diagram-3' : modalType === 'editUser' ? 'geo-alt' : 'person-plus'}`}></i>
              </div>
              {modalType === 'oltPort' ? (oltPortForm.id ? 'Edit' : 'Add') + ' OLT Port' :
               modalType === 'node' ? (nodeForm.id ? 'Edit ' : 'Add ') + (modalData?.parentNodeId && nodeForm.type === 'ODC' ? 'Sub-ODC (Optical Distribution Cabinet)' : nodeForm.type === 'ODP' ? 'ODP (Optical Distribution Point)' : 'ODC (Optical Distribution Cabinet)') :
               modalType === 'splitter' ? 'Add Fiber Splitter' : 
               modalType === 'editUser' ? 'Set Customer Location' : 'Assign Client to Fiber'}
            </h5>
            <button type="button" className="btn-close bg-secondary bg-opacity-10 p-2 rounded-circle shadow-none" onClick={closeModal}></button>
          </div>

          <form onSubmit={
            modalType === 'oltPort' ? submitOltPort : 
            modalType === 'node' ? submitNode : 
            modalType === 'splitter' ? submitSplitter : 
            modalType === 'editUser' ? handleUpdateUser :
            submitAssign
          } className="d-flex flex-column overflow-hidden" style={{ flex: 1 }}>
            <div className="modal-body p-4 overflow-y-auto">
              {/* OLT PORT FORM */}
              {modalType === 'oltPort' && (
                <>
                  <h6 className="text-muted text-uppercase fw-bold mb-3 small tracking-wider"><i className="bi bi-plug me-2 text-primary"></i>Pengaturan Port OLT</h6>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Router Mikrotik *</label>
                      <select className="form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none" required value={oltPortForm.routerId} onChange={(e) => setOltPortForm({ ...oltPortForm, routerId: e.target.value })}>
                        <option value="">Pilih Router</option>
                        {routers.map(r => <option key={r.id} value={r.id}>{r.name} • {r.host}</option>)}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Nama Port *</label>
                      <input className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none" placeholder="contoh: OLT PORT 1" value={oltPortForm.name} onChange={(e) => setOltPortForm({ ...oltPortForm, name: e.target.value })} required />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label small fw-bold text-secondary mb-1">Interface GPON *</label>
                      <input className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none" placeholder="contoh: GPON0/1" value={oltPortForm.port} onChange={(e) => setOltPortForm({ ...oltPortForm, port: e.target.value })} required />
                    </div>
                  </div>
                  <h6 className="text-muted text-uppercase fw-bold mb-2 small tracking-wider"><i className="bi bi-geo-alt me-2 text-primary"></i>Koordinat Lokasi (Opsional)</h6>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <small className="text-muted"><i className="bi bi-hand-index me-1 text-primary"></i>Klik pada peta untuk menandai titik lokasi OLT Port</small>
                    {oltPortForm.latitude && oltPortForm.longitude && (
                      <button type="button" className="btn btn-sm btn-outline-danger rounded-3 py-1 px-2 shadow-sm" onClick={() => setOltPortForm(prev => ({ ...prev, latitude: '', longitude: '' }))}>
                        <i className="bi bi-x-circle me-1"></i> Hapus Pin
                      </button>
                    )}
                  </div>
                  <div className="rounded-4 overflow-hidden border border-secondary-subtle shadow-sm mb-2">
                    <MapPicker
                      key={`olt-map-${showModal}-${oltPortForm.id}`}
                      lat={oltPortForm.latitude}
                      lng={oltPortForm.longitude}
                      height={240}
                      onChange={(lat, lng) => setOltPortForm(prev => ({
                        ...prev,
                        latitude: lat === "" ? "" : Number(lat).toFixed(7),
                        longitude: lng === "" ? "" : Number(lng).toFixed(7),
                      }))}
                    />
                  </div>
                </>
              )}

              {/* NODE FORM */}
              {modalType === 'node' && (
                <>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Nama Node *</label>
                      <input className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none" placeholder="contoh: ODC-KOTA" value={nodeForm.name} onChange={(e) => setNodeForm({ ...nodeForm, name: e.target.value })} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Tipe Node *</label>
                      <select 
                        className="form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none" 
                        required 
                        value={nodeForm.type} 
                        onChange={(e) => setNodeForm({ ...nodeForm, type: e.target.value })}
                      >
                        <option value="ODC">ODC (Optical Distribution Cabinet)</option>
                        <option value="ODP">ODP (Optical Distribution Point)</option>
                      </select>
                    </div>
                  </div>

                  {nodeForm.type === 'ODC' ? (
                    <div className="row g-3 mb-4 p-4 rounded-4 bg-primary bg-opacity-10 border border-primary-subtle shadow-sm">
                       <div className="col-12 mb-0">
                         <small className="text-primary fw-bold d-flex align-items-center gap-2 mb-1">
                           <i className="bi bi-hdd-network fs-5"></i> Sumber Jalur Fiber (OLT Port & Parent ODC)
                         </small>
                       </div>
                       <div className="col-md-6 mt-0">
                         <label className="form-label small fw-bold text-secondary mb-1">Ke OLT Port Utama *</label>
                         <select 
                           className={`form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none ${(!nodeForm.id && (modalData?.oltPortId || modalData?.parentNodeId || nodeForm.splitterOutputId) && nodeForm.oltPortId) ? 'bg-light' : ''}`} 
                           value={nodeForm.oltPortId} 
                           disabled={!nodeForm.id && (!!modalData?.oltPortId || !!modalData?.parentNodeId || !!nodeForm.splitterOutputId) && !!nodeForm.oltPortId}
                           onChange={(e) => setNodeForm({ ...nodeForm, oltPortId: e.target.value })} 
                           required
                         >
                           <option value="">— Pilih OLT Port —</option>
                           {filteredOltPorts.map(p => <option key={p.id} value={p.id}>{p.name} • {p.port}</option>)}
                         </select>
                         {!nodeForm.id && (!!modalData?.oltPortId || !!modalData?.parentNodeId || !!nodeForm.splitterOutputId) && !!nodeForm.oltPortId && (
                           <small className="text-success mt-1 d-flex align-items-center gap-1 fw-medium">
                             <i className="bi bi-lock-fill"></i> Terkunci otomatis ke OLT Port utama
                           </small>
                         )}
                       </div>
                       <div className="col-md-6 mt-0">
                         <label className="form-label small fw-bold text-secondary mb-1">Ke Parent ODC (Sub-ODC)</label>
                         <select 
                           className={`form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none ${(!nodeForm.id && (modalData?.parentNodeId || nodeForm.splitterOutputId)) ? 'bg-light' : ''}`} 
                           value={nodeForm.parentNodeId} 
                           disabled={!nodeForm.id && (!!modalData?.parentNodeId || !!nodeForm.splitterOutputId)}
                           onChange={(e) => {
                             const pId = e.target.value;
                             const pNode = nodes.find(n => Number(n.id) === Number(pId));
                             setNodeForm({ ...nodeForm, parentNodeId: pId, oltPortId: pNode?.oltPortId || nodeForm.oltPortId });
                           }}
                         >
                           <option value="">— Tidak Ada (Langsung OLT) —</option>
                           {nodes.filter(n => n.id !== nodeForm.id && n.type === 'ODC').map(n => <option key={n.id} value={n.id}>[{n.type}] {n.name}</option>)}
                         </select>
                         {!nodeForm.id && (!!modalData?.parentNodeId || !!nodeForm.splitterOutputId) && (
                           <small className="text-success mt-1 d-flex align-items-center gap-1 fw-medium">
                             <i className="bi bi-lock-fill"></i> Terkunci otomatis ke Parent ODC sebagai sumber Sub-ODC
                           </small>
                         )}
                       </div>
                       {nodeForm.splitterOutputId && (() => {
                         const out = splitters.flatMap(s => s.outputs || []).find(o => Number(o.id) === Number(nodeForm.splitterOutputId));
                         const spl = splitters.find(s => Number(s.id) === Number(out?.splitterId));
                         const nod = nodes.find(n => Number(n.id) === Number(spl?.nodeId));
                         return out ? (
                           <div className="col-12 mt-3 animate__animated animate__fadeIn">
                             <label className="form-label small fw-bold text-secondary mb-1">Port Splitter Sumber (Terpilih Sebelumnya) *</label>
                             <div className="form-control form-control-lg rounded-3 bg-success-subtle border-success text-success-emphasis fw-bold d-flex align-items-center gap-2 fs-6 shadow-none">
                               <i className="bi bi-check-circle-fill text-success fs-5"></i>
                               <span>{nod?.name} • {spl?.name || `Splitter #${spl?.id}`} • Port #{out.portNumber}</span>
                             </div>
                             <small className="text-success mt-1 d-flex align-items-center gap-1 fw-medium">
                               <i className="bi bi-lock-fill"></i> Terkunci otomatis ke port yang telah Anda pilih sebelumnya di modal assign.
                             </small>
                           </div>
                         ) : null;
                       })()}
                    </div>
                  ) : (
                    <div className="row g-3 mb-4 p-4 rounded-4 bg-warning bg-opacity-10 border border-warning-subtle shadow-sm">
                       <div className="col-12 mb-0">
                         <small className="text-warning-emphasis fw-bold d-flex align-items-center gap-2 mb-1">
                           <i className="bi bi-hdd-network fs-5"></i> Sumber Jalur Fiber (OLT Port & Parent ODC)
                         </small>
                       </div>
                       <div className="col-md-6 mt-0">
                         <label className="form-label small fw-bold text-secondary mb-1">OLT Port Utama *</label>
                         <select 
                           className={`form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none ${(!nodeForm.id && (modalData?.oltPortId || modalData?.parentNodeId || nodeForm.splitterOutputId) && nodeForm.oltPortId) ? 'bg-light' : ''}`} 
                           value={nodeForm.oltPortId} 
                           disabled={!nodeForm.id && (!!modalData?.oltPortId || !!modalData?.parentNodeId || !!nodeForm.splitterOutputId) && !!nodeForm.oltPortId}
                           onChange={(e) => setNodeForm({ ...nodeForm, oltPortId: e.target.value })} 
                           required
                         >
                           <option value="">— Pilih OLT Port —</option>
                           {filteredOltPorts.map(p => <option key={p.id} value={p.id}>{p.name} • {p.port}</option>)}
                         </select>
                         {!nodeForm.id && (!!modalData?.oltPortId || !!modalData?.parentNodeId || !!nodeForm.splitterOutputId) && !!nodeForm.oltPortId && (
                           <small className="text-success mt-1 d-flex align-items-center gap-1 fw-medium">
                             <i className="bi bi-lock-fill"></i> Terkunci otomatis ke OLT Port utama
                           </small>
                         )}
                       </div>
                       <div className="col-md-6 mt-0">
                         <label className="form-label small fw-bold text-secondary mb-1">Parent Node (Sumber ODC) *</label>
                         <select 
                           className={`form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none ${(!nodeForm.id && (modalData?.parentNodeId || nodeForm.splitterOutputId)) ? 'bg-light' : ''}`} 
                           required 
                           value={nodeForm.parentNodeId} 
                           disabled={!nodeForm.id && (!!modalData?.parentNodeId || !!nodeForm.splitterOutputId)}
                           onChange={(e) => {
                             const pId = e.target.value;
                             const pNode = nodes.find(n => Number(n.id) === Number(pId));
                             setNodeForm({ ...nodeForm, parentNodeId: pId, oltPortId: pNode?.oltPortId || nodeForm.oltPortId });
                           }}
                         >
                           <option value="">— Pilih Parent Node —</option>
                           {nodes.filter(n => n.id !== nodeForm.id && n.type === 'ODC').map(n => <option key={n.id} value={n.id}>[{n.type}] {n.name}</option>)}
                         </select>
                         {!nodeForm.id && (!!modalData?.parentNodeId || !!nodeForm.splitterOutputId) && (
                           <small className="text-success mt-1 d-flex align-items-center gap-1 fw-medium">
                             <i className="bi bi-lock-fill"></i> Terkunci otomatis ke Parent ODC
                           </small>
                         )}
                       </div>
                       {nodeForm.splitterOutputId && (() => {
                         const out = splitters.flatMap(s => s.outputs || []).find(o => Number(o.id) === Number(nodeForm.splitterOutputId));
                         const spl = splitters.find(s => Number(s.id) === Number(out?.splitterId));
                         const nod = nodes.find(n => Number(n.id) === Number(spl?.nodeId));
                         return out ? (
                           <div className="col-12 mt-3 animate__animated animate__fadeIn">
                             <label className="form-label small fw-bold text-secondary mb-1">Port Splitter Sumber (Terpilih Sebelumnya) *</label>
                             <div className="form-control form-control-lg rounded-3 bg-success-subtle border-success text-success-emphasis fw-bold d-flex align-items-center gap-2 fs-6 shadow-none">
                               <i className="bi bi-check-circle-fill text-success fs-5"></i>
                               <span>{nod?.name} • {spl?.name || `Splitter #${spl?.id}`} • Port #{out.portNumber}</span>
                             </div>
                             <small className="text-success mt-1 d-flex align-items-center gap-1 fw-medium">
                               <i className="bi bi-lock-fill"></i> Terkunci otomatis ke port yang telah Anda pilih sebelumnya di modal assign.
                             </small>
                           </div>
                         ) : null;
                       })()}
                       <div className="col-12 mt-3">
                         <label className="form-label small fw-bold text-secondary mb-1">Tipe Rasio Splitter Bawaan *</label>
                         <select 
                           className="form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none" 
                           required 
                           disabled={!!nodeForm.id}
                           value={nodeForm.splitterType} 
                           onChange={(e) => setNodeForm({ ...nodeForm, splitterType: e.target.value })}
                         >
                           {Object.entries(SPLITTER_TYPES).filter(([k]) => k !== 'NONE').map(([key, val]) => (
                             <option key={key} value={key}>{getSplitterLabel(key)} ({val} port output)</option>
                           ))}
                         </select>
                         <small className="text-muted mt-1 d-block"><i className="bi bi-info-circle me-1"></i> Splitter dan port output akan dibuat secara otomatis di dalam node ini saat disimpan.</small>
                       </div>
                    </div>
                  )}

                  {nodeForm.parentNodeId && (
                    <div className="p-4 bg-light rounded-4 border border-secondary-subtle mb-4 shadow-sm">
                      <h6 className="text-dark fw-bold mb-3 small text-uppercase tracking-wider d-flex align-items-center gap-2"><i className="bi bi-link-45deg text-primary fs-5"></i> Pengaturan Link Fiber</h6>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label small fw-bold text-secondary mb-1">Tipe Kabel</label>
                          <select className="form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none" value={nodeForm.cableType} onChange={(e) => setNodeForm({ ...nodeForm, cableType: e.target.value })}>
                            {Object.entries(CABLE_TYPES).map(([key, val]) => <option key={key} value={key}>{getCableLabel(key)} ({val} core)</option>)}
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-bold text-secondary mb-1">Jarak Tarikan (meter)</label>
                          <input type="number" className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none" min="0" placeholder="contoh: 150" value={nodeForm.distanceMeter} onChange={(e) => setNodeForm({ ...nodeForm, distanceMeter: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  )}

                  <h6 className="text-muted text-uppercase fw-bold mb-2 small tracking-wider"><i className="bi bi-geo-alt me-2 text-primary"></i>Koordinat Lokasi Node</h6>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <small className="text-muted"><i className="bi bi-hand-index me-1 text-primary"></i>Klik pada peta untuk menandai titik lokasi node</small>
                    {nodeForm.latitude && nodeForm.longitude && (
                      <button type="button" className="btn btn-sm btn-outline-danger rounded-3 py-1 px-2 shadow-sm" onClick={() => setNodeForm(prev => ({ ...prev, latitude: '', longitude: '' }))}>
                        <i className="bi bi-x-circle me-1"></i> Hapus Pin
                      </button>
                    )}
                  </div>
                  <div className="rounded-4 overflow-hidden border border-secondary-subtle shadow-sm mb-4">
                    <MapPicker
                      key={`node-map-${showModal}-${nodeForm.id}`}
                      lat={nodeForm.latitude}
                      lng={nodeForm.longitude}
                      height={240}
                      onChange={(lat, lng) => setNodeForm(prev => ({
                        ...prev,
                        latitude: lat === "" ? "" : Number(lat).toFixed(7),
                        longitude: lng === "" ? "" : Number(lng).toFixed(7),
                      }))}
                    />
                  </div>
                </>
              )}

              {/* SPLITTER FORM */}
              {modalType === 'splitter' && (
                <>
                  <div className="mb-4">
                    <label className="form-label small fw-bold text-secondary mb-1">Pilih Node (ODC/ODP) *</label>
                    <select
                      className="form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                      required
                      disabled={!!splitterForm.id}
                      value={splitterForm.nodeId}
                      onChange={(e) => setSplitterForm({ ...splitterForm, nodeId: e.target.value })}
                    >
                      <option value="">— Pilih Node —</option>
                      {nodes.map(n => (
                        <option key={n.id} value={n.id}>[{n.type}] {n.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="form-label small fw-bold text-secondary mb-1">Tipe Rasio Splitter *</label>
                    <select className="form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none" required disabled={!!splitterForm.id} value={splitterForm.type} onChange={(e) => { const type = e.target.value; const ports = SPLITTER_TYPES[type] || 8; setSplitterForm({ ...splitterForm, type, outputPort: ports }); }}>
                      {Object.entries(SPLITTER_TYPES).filter(([k]) => k !== 'NONE').map(([key, val]) => (<option key={key} value={key}>{getSplitterLabel(key)} ({val} port output)</option>))}
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="form-label small fw-bold text-secondary mb-1">Jumlah Port Output</label>
                    <input type="number" className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none" min="1" max="64" disabled={!!splitterForm.id} value={splitterForm.outputPort} onChange={(e) => setSplitterForm({ ...splitterForm, outputPort: Number(e.target.value) })} />
                    <small className="text-muted mt-1 d-block"><i className="bi bi-info-circle me-1"></i> Jumlah port output fiber yang akan dibuat secara otomatis</small>
                  </div>
                  <div className="mb-4">
                    <label className="form-label small fw-bold text-secondary mb-1">Nama Splitter (Opsional)</label>
                    <input className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none" placeholder="contoh: Splitter ODC 1" value={splitterForm.name} onChange={(e) => setSplitterForm({ ...splitterForm, name: e.target.value })} />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-bold text-secondary mb-1">Catatan / Deskripsi</label>
                    <textarea className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none" rows="2" placeholder="Tambahkan keterangan penempatan atau fungsi splitter..." value={splitterForm.description} onChange={(e) => setSplitterForm({ ...splitterForm, description: e.target.value })}></textarea>
                  </div>
                </>
              )}

              {/* EDIT USER LOCATION FORM */}
              {modalType === 'editUser' && (
                <>
                  <div className="mb-4">
                    <label className="form-label small fw-bold text-secondary mb-1">Nama Pelanggan</label>
                    <input type="text" className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 bg-light shadow-none" value={userForm.username} readOnly />
                  </div>
                  <h6 className="text-muted text-uppercase fw-bold mb-2 small tracking-wider"><i className="bi bi-geo-alt me-2 text-primary"></i>Titik Lokasi Pelanggan</h6>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <small className="text-muted"><i className="bi bi-hand-index me-1 text-primary"></i>Klik pada peta untuk menentukan koordinat akurat rumah pelanggan</small>
                    {userForm.latitude && userForm.longitude && (
                      <button type="button" className="btn btn-sm btn-outline-danger rounded-3 py-1 px-2 shadow-sm" onClick={() => setUserForm(prev => ({ ...prev, latitude: '', longitude: '' }))}>
                        <i className="bi bi-x-circle me-1"></i> Hapus Pin
                      </button>
                    )}
                  </div>
                  <div className="rounded-4 overflow-hidden border border-secondary-subtle shadow-sm mb-4">
                    <MapPicker
                      key={`user-map-${showModal}-${userForm.username}`}
                      lat={userForm.latitude}
                      lng={userForm.longitude}
                      height={260}
                      onChange={(lat, lng) => setUserForm(prev => ({
                        ...prev,
                        latitude: lat === "" ? "" : Number(lat).toFixed(7),
                        longitude: lng === "" ? "" : Number(lng).toFixed(7),
                      }))}
                    />
                  </div>
                  <div className="alert alert-info border border-info-subtle bg-info bg-opacity-10 rounded-4 p-3 small mb-0 shadow-sm d-flex align-items-center gap-2">
                    <i className="bi bi-info-circle-fill text-info fs-5"></i>
                    <div>Koordinat GPS ini digunakan untuk merekomendasikan port ODP terdekat secara otomatis saat pemasangan kabel fisik.</div>
                  </div>
                </>
              )}

              {/* ASSIGN FORM */}
              {modalType === 'assign' && (() => {
                const currentOutput = splitters.flatMap(s => s.outputs || []).find(o => Number(o.id) === Number(modalData?.outputId || assignForm.outputId));
                const currentSplitter = splitters.find(s => s.id === currentOutput?.splitterId);
                const parentNode = nodes.find(n => n.id === currentSplitter?.nodeId);
                const isOdcSplitter = parentNode?.type === 'ODC';

                return (
                  <>
                    {isOdcSplitter && !modalData?.clientId ? (
                      <div className="mb-4">
                        <label className="form-label small fw-bold text-secondary mb-2">Tipe Pemasangan Port (ODC Splitter) *</label>
                        <div className="d-flex gap-2 p-1 bg-light rounded-3 border border-secondary-subtle">
                          <button 
                            type="button" 
                            className={`btn btn-sm flex-fill fw-semibold rounded-2 py-2 ${assignForm.assignType === 'client' ? 'btn-primary shadow-sm' : 'btn-light text-muted'}`}
                            onClick={() => setAssignForm({ ...assignForm, assignType: 'client', targetNodeId: '' })}
                          >
                            <i className="bi bi-people me-2"></i>Ke Pelanggan (Client)
                          </button>
                          <button 
                            type="button" 
                            className={`btn btn-sm flex-fill fw-semibold rounded-2 py-2 ${assignForm.assignType === 'node' ? 'btn-primary shadow-sm' : 'btn-light text-muted'}`}
                            onClick={() => setAssignForm({ ...assignForm, assignType: 'node', clientId: '' })}
                          >
                            <i className="bi bi-diagram-2 me-2"></i>Ke Node Lanjutan (ODC/ODP)
                          </button>
                        </div>
                      </div>
                    ) : modalData?.clientId ? (
                      <div className="alert alert-info border border-info-subtle bg-info bg-opacity-10 rounded-4 p-3 small mb-4 shadow-sm d-flex align-items-center gap-2">
                        <i className="bi bi-person-check-fill text-info fs-5"></i>
                        <div><strong>Pemasangan Pelanggan:</strong> Mode pemasangan dikunci untuk menghubungkan port fiber langsung ke akun PPPoE Pelanggan ini.</div>
                      </div>
                    ) : (
                      <div className="alert alert-warning border border-warning-subtle bg-warning bg-opacity-10 rounded-4 p-3 small mb-4 shadow-sm d-flex align-items-center gap-2">
                        <i className="bi bi-info-circle-fill text-warning fs-5"></i>
                        <div><strong>Aturan Topologi ODP:</strong> Port splitter pada ODP hanya dapat dihubungkan langsung ke Pelanggan (PPPoE Client).</div>
                      </div>
                    )}

                    {assignForm.assignType === 'node' ? (() => {
                      const unassignedChildNodes = nodes.filter(n => {
                        const isAssigned = splitters.some(s => (s.outputs || []).some(o => Number(o.targetNodeId) === Number(n.id)));
                        const isChild = Number(n.parentNodeId) === Number(parentNode?.id) || (n.incomingLinks || []).some(l => Number(l.fromNodeId) === Number(parentNode?.id));
                        return !isAssigned && isChild;
                      });

                      return (
                        <div className="mb-4 bg-light p-4 rounded-4 border border-secondary-subtle text-center animate__animated animate__fadeIn">
                          <i className="bi bi-diagram-3-fill text-primary fs-1 d-block mb-2"></i>
                          <h6 className="fw-bold text-dark mb-3">Pemasangan / Penambahan Node Lanjutan (ODC / ODP)</h6>
                          
                          {unassignedChildNodes.length > 0 ? (
                            <div className="mb-4 text-start bg-white p-3 rounded-3 border border-secondary-subtle shadow-sm">
                              <label className="form-label small fw-bold text-secondary mb-2">
                                <i className="bi bi-link-45deg me-1 text-primary"></i>Pilih Node Lanjutan yang Sudah Ada di Bawah {parentNode?.name} *
                              </label>
                              <select 
                                className="form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none mb-2"
                                value={assignForm.targetNodeId || ''}
                                onChange={(e) => setAssignForm({ ...assignForm, targetNodeId: e.target.value })}
                              >
                                <option value="">— Pilih Node yang Sudah Ada —</option>
                                {unassignedChildNodes.map(cn => (
                                  <option key={cn.id} value={cn.id}>[{cn.type}] {cn.name}</option>
                                ))}
                              </select>
                              <small className="text-muted d-block small">Pilih node yang telah dibuat sebelumnya agar terhubung secara fisik ke port splitter ini.</small>
                            </div>
                          ) : (
                            <p className="text-muted small mb-4">
                              Tidak ada node lanjutan yang belum terpasang di bawah {parentNode?.name}. Silakan buat node baru agar terhubung langsung ke port fiber ini.
                            </p>
                          )}

                          <div className="d-flex align-items-center justify-content-center gap-3 flex-wrap">
                            <button 
                              type="button" 
                              className="btn btn-primary btn-lg px-4 fw-semibold shadow-sm d-inline-flex align-items-center gap-2"
                              onClick={() => {
                                openModal("node", {
                                  parentNodeId: parentNode?.id,
                                  oltPortId: parentNode?.oltPortId,
                                  type: parentNode?.type === 'ODC' ? 'ODP' : 'ODC',
                                  splitterOutputId: assignForm.outputId
                                });
                              }}
                            >
                              <i className="bi bi-plus-circle-fill fs-5"></i>Buat Node Baru (ODC / ODP)
                            </button>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="mb-4">
                        <label className="form-label small fw-bold text-secondary mb-1">Akun PPPoE Pelanggan *</label>
                        <div className="position-relative">
                          <button 
                            type="button" 
                            className="form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none text-start d-flex justify-content-between align-items-center bg-white w-100 py-2 px-3"
                            onClick={() => setClientDropdownOpen(!clientDropdownOpen)}
                          >
                            <span className={assignForm.clientId ? "text-dark fw-medium" : "text-muted"}>
                              {assignForm.clientId 
                                ? (() => {
                                    const u = availableUsers.find(u => Number(u.id) === Number(assignForm.clientId));
                                    return u ? `${u.username} ${u.latitude ? '📍 (Ada Lokasi)' : '(Belum Ada Lokasi)'}` : '— Pilih Pelanggan —';
                                  })()
                                : '— Pilih Pelanggan —'
                              }
                            </span>
                          </button>

                          {clientDropdownOpen && (
                            <div className="position-absolute start-0 end-0 mt-1 bg-white border border-secondary-subtle rounded-3 shadow-lg z-3" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                              <div className="p-2 border-bottom position-sticky top-0 bg-white z-2">
                                <div className="input-group input-group-sm shadow-sm">
                                  <span className="input-group-text bg-light border-secondary-subtle text-muted"><i className="bi bi-search"></i></span>
                                  <input 
                                    type="text" 
                                    className="form-control border-secondary-subtle shadow-none fs-6" 
                                    placeholder="Ketik nama pelanggan untuk mencari..." 
                                    value={userSearch} 
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    autoFocus 
                                  />
                                  {userSearch && (
                                    <button type="button" className="btn btn-outline-secondary border-secondary-subtle" onClick={() => setUserSearch('')}>
                                      <i className="bi bi-x-lg"></i>
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="list-group list-group-flush">
                                {availableUsers
                                  .filter(u => !userSearch || u.username.toLowerCase().includes(userSearch.toLowerCase()))
                                  .map(u => (
                                    <button 
                                      key={u.id} 
                                      type="button" 
                                      className={`list-group-item list-group-item-action py-2 px-3 text-start fs-6 ${Number(assignForm.clientId) === Number(u.id) ? 'bg-primary-subtle text-primary fw-bold' : ''}`}
                                      onClick={() => {
                                        setAssignForm({ ...assignForm, clientId: u.id.toString() });
                                        setClientDropdownOpen(false);
                                        setUserSearch('');
                                      }}
                                    >
                                      <div className="d-flex justify-content-between align-items-center">
                                        <span>{u.username}</span>
                                        <small className="text-muted">{u.latitude ? '📍 Ada Lokasi' : 'Belum Ada Lokasi'}</small>
                                      </div>
                                    </button>
                                  ))}
                                {availableUsers.filter(u => !userSearch || u.username.toLowerCase().includes(userSearch.toLowerCase())).length === 0 && (
                                  <div className="p-3 text-center text-muted small fst-italic">
                                    Tidak ada pelanggan yang cocok dengan "{userSearch}"
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="form-label small fw-bold text-secondary mb-1">
                        {assignForm.assignType === 'client' && assignForm.clientId ? 'Rekomendasi Port Fiber Terdekat (Auto-Sorted) *' : 'Daftar Port Fiber Tersedia *'}
                      </label>
                      <select 
                        className={`form-select form-select-lg rounded-3 border-secondary-subtle fs-6 shadow-none ${modalData?.outputId ? 'bg-light' : ''}`}
                        required 
                        disabled={!!modalData?.outputId}
                        value={assignForm.outputId} 
                        onChange={(e) => setAssignForm({ ...assignForm, outputId: e.target.value })}
                      >
                        {modalData?.outputId ? (
                          (() => {
                            const out = splitters.flatMap(s => s.outputs || []).find(o => o.id === Number(modalData.outputId));
                            const spl = splitters.find(s => s.id === out?.splitterId);
                            const nod = nodes.find(n => n.id === spl?.nodeId);
                            return (
                              <option value={out?.id}>
                                {nod?.name} • {spl?.name || `Splitter #${spl?.id}`} • Port #{out?.portNumber}
                              </option>
                            );
                          })()
                        ) : (
                          <>
                            <option value="">— Pilih Port Fiber —</option>
                            {(() => {
                              const selectedUser = pppoeUsers.find(u => Number(u.id) === Number(assignForm.clientId));
                              
                              const options = splitters.flatMap(s => {
                                const node = nodes.find(n => Number(n.id) === Number(s.nodeId));
                                const dist = selectedUser && node ? getDistance(selectedUser.latitude, selectedUser.longitude, node.latitude, node.longitude) : Infinity;
                                
                                return (s.outputs || [])
                                  .filter(o => !o.isUsed)
                                  .map(o => ({
                                    ...o,
                                    splitterName: s.name || `Splitter #${s.id}`,
                                    nodeName: node?.name || `Node #${s.nodeId}`,
                                    nodeType: node?.type || '?',
                                    distance: dist
                                  }));
                              });

                              if (selectedUser?.latitude) {
                                options.sort((a, b) => a.distance - b.distance);
                              }

                              return options.map(o => (
                                <option key={o.id} value={o.id}>
                                  {o.distance !== Infinity ? `[${o.distance}m] ` : ''}
                                  {o.nodeName} • {o.splitterName} • Port #{o.portNumber}
                                </option>
                              ));
                            })()}
                          </>
                        )}
                      </select>
                      {assignForm.assignType === 'client' && assignForm.clientId && !pppoeUsers.find(u => Number(u.id) === Number(assignForm.clientId))?.latitude && (
                        <div className="small text-danger mt-2 d-flex align-items-center gap-1 fw-medium">
                          <i className="bi bi-exclamation-triangle-fill"></i> Pelanggan belum memiliki koordinat GPS. Rekomendasi port terdekat tidak dapat ditampilkan.
                        </div>
                      )}
                    </div>
                    
                    {assignForm.outputId && (assignForm.clientId || assignForm.targetNodeId) && (
                      <div className="alert alert-success border border-success-subtle bg-success bg-opacity-10 rounded-4 p-3 small mb-0 shadow-sm d-flex align-items-center gap-2">
                        <i className="bi bi-check-circle-fill text-success fs-5"></i> 
                        <div>Jalur siap diaktifkan. Setelah kabel fisik dicolok, status koneksi akan otomatis terdeteksi.</div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="modal-footer py-3 px-4 bg-light border-top border-secondary-subtle">
              <button type="button" className="btn btn-secondary rounded-3 px-4 py-2 fw-medium shadow-sm" onClick={closeModal} disabled={submitting}>Batal</button>
              <button type="submit" className="btn btn-primary rounded-3 px-4 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2" disabled={submitting}>
                {submitting ? (<><span className="spinner-border spinner-border-sm" role="status"></span> Menyimpan...</>) : (<><i className="bi bi-check-lg"></i> Simpan Perubahan</>)}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
