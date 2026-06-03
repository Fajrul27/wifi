// components/EditSecret.jsx

import { useEffect, useState } from "react";

export default function EditSecret({
  show,
  onClose,
  routerId,
  username,
  onSaved,
}) {
  /* =========================
     STATE
  ========================= */
  const [enabled, setEnabled] = useState(true);
  const [comment, setComment] = useState("");
  const [password, setPassword] = useState("");
  const [service, setService] = useState("pppoe");
  const [profiles, setProfiles] = useState([]);
  const [profile, setProfile] = useState("");
  const [callerId, setCallerId] = useState("");
  const [localAddress, setLocalAddress] = useState("");
  const [remoteAddress, setRemoteAddress] = useState("");
  const [routes, setRoutes] = useState("");
  const [limitBytesIn, setLimitBytesIn] = useState("");
  const [limitBytesOut, setLimitBytesOut] = useState("");
  const [onlyOne, setOnlyOne] = useState(false);
  const [rateLimit, setRateLimit] = useState("");
  const [addressList, setAddressList] = useState("");
  const [remoteIpv6PrefixPool, setRemoteIpv6PrefixPool] = useState("");

  const [loadingData, setLoadingData] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [saving, setSaving] = useState(false);

  /* =========================
     LOAD PROFILES AND SECRET
  ========================= */
  useEffect(() => {
    if (!show || !routerId || !username) return;

    const loadData = async () => {
      try {
        setLoadingData(true);
        setLoadingProfiles(true);

        const apiUrl = (process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost') ? '/api' : 'http://localhost:3000/api';
        
        // Fetch Profiles
        const profRes = await fetch(
          `${apiUrl}/pppoe/${routerId}/profiles`
        );
        const profJson = await profRes.json();
        const profData = profJson.data || [];
        setProfiles(profData);

        // Fetch Secret Detail
        const secretRes = await fetch(
          `${apiUrl}/pppoe/${routerId}/user/${username}`
        );
        const secretJson = await secretRes.json();
        
        if (!secretRes.ok || !secretJson.success) {
          throw new Error(secretJson.message || "Gagal load detail PPPoE secret");
        }

        const data = secretJson.data || {};
        
        // Map data to state
        setEnabled(data.disabled !== "yes" && data.disabled !== "true" && data.disabled !== true);
        setComment(data.comment || "");
        setPassword(data.password || "");
        setService(data.service || "pppoe");
        setProfile(data.profile || "");
        setCallerId(data["caller-id"] || "");
        setLocalAddress(data["local-address"] || "");
        setRemoteAddress(data["remote-address"] || "");
        setRoutes(data.routes || "");
        setLimitBytesIn(data["limit-bytes-in"] || "");
        setLimitBytesOut(data["limit-bytes-out"] || "");
        setOnlyOne(data["only-one"] === "yes" || data["only-one"] === "true" || data["only-one"] === true);
        setRateLimit(data["rate-limit"] || "");
        setAddressList(data["address-list"] || "");
        setRemoteIpv6PrefixPool(data["remote-ipv6-prefix-pool"] || "");

      } catch (err) {
        console.error(err);
        alert(err.message || "Gagal load data");
        onClose();
      } finally {
        setLoadingData(false);
        setLoadingProfiles(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, routerId, username]);

  /* =========================
     SAVE
  ========================= */
  const handleSave = async () => {
    try {
      setSaving(true);

      const payload = {
        password,
        service,
        profile,
        disabled: !enabled,
        comment: comment.trim(),
        "caller-id": callerId.trim(),
        "local-address": localAddress.trim(),
        "remote-address": remoteAddress.trim(),
        routes: routes.trim(),
        "limit-bytes-in": limitBytesIn,
        "limit-bytes-out": limitBytesOut,
        "only-one": onlyOne,
        "rate-limit": rateLimit.trim(),
        "address-list": addressList.trim(),
        "remote-ipv6-prefix-pool": remoteIpv6PrefixPool.trim(),
      };

      const apiUrl = (process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost') ? '/api' : 'http://localhost:3000/api';
      const res = await fetch(
        `${apiUrl}/pppoe/${routerId}/user/${username}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Gagal update PPP secret");
      }

      if (onSaved) {
        await onSaved();
      }

      onClose();
    } catch (err) {
      console.error(err);
      alert(err.message || "Gagal update PPP secret");
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{
        background: "rgba(0,0,0,0.25)",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        className="modal-dialog"
        style={{
          width: 560,
          maxWidth: "95%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="modal-content bg-body text-body border shadow"
          style={{
            borderRadius: 4,
            overflow: "hidden",
            fontSize: 12,
          }}
        >
          {/* HEADER */}
          <div
            className="d-flex justify-content-between align-items-center px-3 py-2 bg-body-tertiary border-bottom"
          >
            <div className="fw-semibold text-body-emphasis">
              Edit PPP Secret: {username}
            </div>
            <button
              type="button"
              className="btn-close"
              style={{ fontSize: 11 }}
              onClick={onClose}
            />
          </div>

          {/* BODY */}
          {loadingData ? (
            <div className="p-4 text-center bg-body">
              <span className="spinner-border spinner-border-sm text-secondary me-2"></span>
              Loading secret details...
            </div>
          ) : (
            <div className="p-3 bg-body">
              {/* ENABLED */}
              <div className="row mb-2 align-items-center">
                <label className="col-4 text-end pe-2">Enabled</label>
                <div className="col-8">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                  />
                </div>
              </div>

              {/* COMMENT */}
              <div className="row mb-2 align-items-center">
                <label className="col-4 text-end pe-2">Comment</label>
                <div className="col-8">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div className="row mb-2 align-items-center">
                <label className="col-4 text-end pe-2">Password</label>
                <div className="col-8">
                  <input
                    type="password"
                    className="form-control form-control-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {/* SERVICE */}
              <div className="row mb-2 align-items-center">
                <label className="col-4 text-end pe-2">Service</label>
                <div className="col-8">
                  <select
                    className="form-select form-select-sm"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                  >
                    <option value="any">any</option>
                    <option value="async">async</option>
                    <option value="l2tp">l2tp</option>
                    <option value="ovpn">ovpn</option>
                    <option value="pppoe">pppoe</option>
                    <option value="pptp">pptp</option>
                    <option value="sstp">sstp</option>
                  </select>
                </div>
              </div>

              {/* PROFILE */}
              <div className="row mb-2 align-items-center">
                <label className="col-4 text-end pe-2">Profile</label>
                <div className="col-8">
                  <select
                    className="form-select form-select-sm"
                    value={profile}
                    disabled={loadingProfiles}
                    onChange={(e) => setProfile(e.target.value)}
                  >
                    {profiles.map((p, i) => (
                      <option key={i} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* CALLER ID */}
              <div className="row mb-2 align-items-center">
                <label className="col-4 text-end pe-2">Caller ID</label>
                <div className="col-8">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={callerId}
                    onChange={(e) => setCallerId(e.target.value)}
                  />
                </div>
              </div>

              {/* LOCAL ADDRESS */}
              <div className="row mb-2 align-items-center">
                <label className="col-4 text-end pe-2">Local Address</label>
                <div className="col-8">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={localAddress}
                    onChange={(e) => setLocalAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* REMOTE ADDRESS */}
              <div className="row mb-2 align-items-center">
                <label className="col-4 text-end pe-2">Remote Address</label>
                <div className="col-8">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={remoteAddress}
                    onChange={(e) => setRemoteAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* ROUTES */}
              <div className="row mb-2 align-items-center">
                <label className="col-4 text-end pe-2">Routes</label>
                <div className="col-8">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={routes}
                    onChange={(e) => setRoutes(e.target.value)}
                  />
                </div>
              </div>

              {/* RATE LIMIT */}
              <div className="row mb-2 align-items-center">
                <label className="col-4 text-end pe-2">Rate Limit</label>
                <div className="col-8">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="10M/10M"
                    value={rateLimit}
                    onChange={(e) => setRateLimit(e.target.value)}
                  />
                </div>
              </div>

              {/* ONLY ONE */}
              <div className="row mb-2 align-items-center">
                <label className="col-4 text-end pe-2">Only One</label>
                <div className="col-8">
                  <input
                    type="checkbox"
                    checked={onlyOne}
                    onChange={(e) => setOnlyOne(e.target.checked)}
                  />
                </div>
              </div>

              {/* ADDRESS LIST */}
              <div className="row mb-2 align-items-center">
                <label className="col-4 text-end pe-2">Address List</label>
                <div className="col-8">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={addressList}
                    onChange={(e) => setAddressList(e.target.value)}
                  />
                </div>
              </div>

              {/* IPV6 POOL */}
              <div className="row mb-0 align-items-center">
                <label className="col-4 text-end pe-2">Remote IPv6 Prefix Pool</label>
                <div className="col-8">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={remoteIpv6PrefixPool}
                    onChange={(e) => setRemoteIpv6PrefixPool(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* FOOTER */}
          <div
            className="px-3 py-2 d-flex justify-content-end gap-2 bg-body-tertiary border-top"
          >
            <button
              className="btn btn-sm btn-light"
              onClick={onClose}
              disabled={saving || loadingData}
            >
              Cancel
            </button>
            <button
              className="btn btn-sm btn-primary"
              disabled={saving || loadingData}
              onClick={handleSave}
            >
              {saving ? "Saving..." : "OK"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
