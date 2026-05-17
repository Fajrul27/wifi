const { RouterOSAPI } = require("node-routeros");
const { PrismaClient } = require("@prisma/client");
const { broadcast } = require("../../utils/socket");
const { decrypt } = require("../../utils/crypto");

const prisma = new PrismaClient();

/* =========================
   SERIALIZE SAFE
========================= */
const serialize = (obj) =>
  JSON.parse(
    JSON.stringify(obj, (_, v) =>
      typeof v === "bigint" ? v.toString() : v
    )
  );

/* =========================
   FORMAT BANDWIDTH
========================= */
function formatBandwidth(bps = 0) {
  const value = Number(bps || 0);
  if (!value) return "0 bps";
  const units = ["bps", "Kbps", "Mbps", "Gbps", "Tbps"];
  let i = 0, num = value;
  while (num >= 1000 && i < units.length - 1) { num /= 1000; i++; }
  return `${num.toFixed(2)} ${units[i]}`;
}

/* =========================
   FORMAT DURATION
========================= */
function formatDuration(ms = 0) {
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  let out = "";
  if (d) out += `${d}d `;
  if (h) out += `${h}h `;
  if (m) out += `${m}m `;
  if (s || !out) out += `${s}s`;
  return out.trim();
}

/* =========================
   NORMALIZE KEY
   Menghapus prefix pppoe- dan <> agar matching konsisten
========================= */
const normalizeKey = (name = "") =>
  String(name)
    .toLowerCase()
    .replace(/^pppoe-/, "")
    .replace(/^<pppoe-/, "")
    .replace(/>$/, "")
    .replace(/[<>]/g, "")
    .replace(/\s/g, "")
    .trim();

/* =========================
   SERVICE CLASS
========================= */
class PppoeService {
  constructor(router) {
    this.router = router;

    const password = decrypt(router.password);

    this._createClient(password);

    this.isRunning = false;
    this.interval = null;
    this.updating = false;

    this.cacheActive = [];
    this.cacheTime = 0;
    this.cacheTTL = 1000;

    // Cache topologi untuk optimasi database
    this.topologyNodesCache = null;
    this.topologyNodesCacheTime = 0;
    this.topologyNodesCacheTTL = 60000;

    this.isConnected = false;

    // === AUTO-RECONNECT STATE ===
    this.reconnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 999; // Praktis tak terbatas
    this.reconnectDelay = 5000;     // Mulai dari 5 detik
    this.maxReconnectDelay = 60000; // Maksimal 60 detik
    this.wasConnected = false;       // Untuk deteksi reconnect setelah putus
  }

  /* =========================
     BUAT CLIENT (bisa dipanggil ulang saat reconnect)
  ========================= */
  _createClient(password) {
    if (!password) {
      const pw = decrypt(this.router.password);
      password = pw;
    }

    // Hapus client lama jika ada
    if (this.client) {
      try { this.client.close(); } catch (_) {}
    }

    this.client = new RouterOSAPI({
      host: this.router.host,
      user: this.router.username,
      password,
      port: this.router.port || 8728,
      timeout: 15000,
    });

    this.client.on("error", (err) => {
      console.error(`[RouterOS][${this.router.host}] ERROR:`, err.message);
      this.isConnected = false;
    });

    this.client.on("close", () => {
      console.warn(`[RouterOS][${this.router.host}] Koneksi ditutup.`);
      this.isConnected = false;
    });

    this.client.on("timeout", () => {
      console.warn(`[RouterOS][${this.router.host}] Timeout.`);
      this.isConnected = false;
    });
  }

  /* =========================
     CONNECT SAFE + AUTO-RECONNECT
  ========================= */
  async connect() {
    if (this.isConnected) return true;
    if (this.reconnecting) return false;

    this.reconnecting = true;

    try {
      // Buat ulang client agar tidak pakai koneksi lama yang rusak
      this._createClient();

      await this.client.connect();
      this.isConnected = true;
      this.reconnecting = false;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 5000;

      if (this.wasConnected) {
        console.log(`[PPPoE][${this.router.host}] ✅ Reconnect BERHASIL! Sinkronisasi ulang...`);
        // Langsung sinkron ulang data dari Mikrotik setelah reconnect
        await this._resyncAfterReconnect();
      } else {
        console.log(`[PPPoE][${this.router.host}] ✅ Koneksi pertama berhasil.`);
      }

      this.wasConnected = true;
      return true;

    } catch (e) {
      this.isConnected = false;
      this.reconnecting = false;
      this.reconnectAttempts++;

      console.warn(
        `[PPPoE][${this.router.host}] ❌ Gagal konek (percobaan ke-${this.reconnectAttempts}): ${e.message}`
      );

      // Broadcast status offline ke frontend
      this._broadcastRouterStatus(false, e.message);

      return false;
    }
  }

  /* =========================
     RE-SYNC SETELAH RECONNECT
     Invalidasi cache agar ambil data fresh dari Mikrotik
  ========================= */
  async _resyncAfterReconnect() {
    try {
      // Invalidasi cache agar ambil data fresh
      this.cacheTime = 0;
      this.cacheActive = [];
      this.topologyNodesCache = null;
      this.topologyNodesCacheTime = 0;

      console.log(`[PPPoE][${this.router.host}] Cache direset setelah reconnect.`);

      // Jika tidak sedang dalam proses updateRealtime, jalankan update
      if (!this.updating) {
        await this.updateRealtime();
      }
    } catch (err) {
      console.error(`[PPPoE] Gagal re-sync:`, err.message);
    }
  }

  /* =========================
     BROADCAST STATUS ROUTER
  ========================= */
  _broadcastRouterStatus(isOnline, reason = "") {
    broadcast({
      type: "router-status",
      routerId: this.router.id,
      isOnline,
      reason,
      ts: Date.now(),
    });
  }

  /* =========================
     WRITE SAFE (MUTEX + TIMEOUT)
  ========================= */
  async write(path, params = []) {
    const prev = this.writeQueue || Promise.resolve();
    let release;
    this.writeQueue = new Promise(resolve => { release = resolve; });

    await prev.catch(() => {});

    try {
      const connected = await this.connect();
      if (!connected) throw new Error("Tidak dapat terhubung ke Mikrotik");

      const res = await Promise.race([
        this.client.write(path, params),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Mikrotik write timeout")), 15000))
      ]);
      return res;
    } finally {
      release();
    }
  }

  /* =========================
     SYNC USERS (dari Mikrotik ke DB)
  ========================= */
  async syncUsers() {
    const connected = await this.connect();
    if (!connected) throw new Error("Tidak dapat terhubung ke Mikrotik");

    let createdProfiles = 0, updatedProfiles = 0;
    let createdUsers = 0, updatedUsers = 0;

    // ==========================================
    // 1. SYNC PROFIL KECEPATAN (SPEED PROFILES)
    // ==========================================
    const mtProfiles = await this.write("/ppp/profile/print");
    const mtProfileMap = new Map((mtProfiles || []).map(p => [p.name, p]));
    const dbProfiles = await prisma.speedProfile.findMany();
    const dbProfileMap = new Map(dbProfiles.map(p => [p.name, p]));

    // A. Dari DB ke Mikrotik (Push yang belum ada atau beda limit)
    for (const dbP of dbProfiles) {
      const mtP = mtProfileMap.get(dbP.name);
      const targetRate = dbP.rateLimit && dbP.rateLimit !== "LOSS" ? dbP.rateLimit : "";
      if (!mtP) {
        const params = [`=name=${dbP.name}`];
        if (targetRate) params.push(`=rate-limit=${targetRate}`);
        await this.write("/ppp/profile/add", params);
        createdProfiles++;
      } else if ((mtP["rate-limit"] || "") !== targetRate) {
        await this.write("/ppp/profile/set", [
          `=.id=${mtP[".id"]}`,
          `=rate-limit=${targetRate}`
        ]);
        updatedProfiles++;
      }
    }

    // B. Dari Mikrotik ke DB (Pull profil mikrotik yang belum ada di DB)
    for (const mtP of mtProfiles || []) {
      if (mtP.name === "default" || mtP.name === "default-encryption") continue;
      if (!dbProfileMap.has(mtP.name)) {
        await prisma.speedProfile.create({
          data: {
            name: mtP.name,
            rateLimit: mtP["rate-limit"] || "LOSS",
            description: "Diimpor otomatis dari Mikrotik saat Sync",
            isActive: true
          }
        });
        createdProfiles++;
      }
    }

    // ==========================================
    // 2. SYNC USER PPPoE (SECRETS)
    // ==========================================
    const secrets = await this.write("/ppp/secret/print");
    const secretMap = new Map((secrets || []).map(s => [s.name, s]));
    const dbUsers = await prisma.pppoeUser.findMany({ where: { routerId: this.router.id } });
    const dbUserMap = new Map(dbUsers.map(u => [u.username, u]));

    // A. Dari Mikrotik ke DB (Pull secret yang belum ada di DB atau update profil/IP/komentarnya)
    for (const s of secrets || []) {
      const username = String(s.name || "").trim();
      if (!username) continue;

      const existing = dbUserMap.get(username);
      const sProfile = s.profile || null;
      const sRemote = s["remote-address"] || null;
      const sLocal = s["local-address"] || null;
      const sComment = s.comment || null;

      if (existing) {
        if (
          existing.profile !== sProfile ||
          existing.remoteAddress !== sRemote ||
          existing.localAddress !== sLocal ||
          existing.keterangan !== sComment
        ) {
          await prisma.pppoeUser.update({
            where: { id: existing.id },
            data: {
              profile: sProfile,
              remoteAddress: sRemote,
              localAddress: sLocal,
              keterangan: sComment || existing.keterangan,
            },
          });
          updatedUsers++;
        }
      } else {
        await prisma.pppoeUser.create({
          data: {
            routerId: this.router.id,
            username,
            profile: sProfile,
            remoteAddress: sRemote,
            localAddress: sLocal,
            keterangan: sComment || "",
            isOnline: false,
          },
        });
        createdUsers++;
      }
    }

    // B. Dari DB ke Mikrotik (Push user DB yang belum ada di Mikrotik secret)
    for (const u of dbUsers) {
      if (!secretMap.has(u.username)) {
        await this.write("/ppp/secret/add", [
          `=name=${u.username}`,
          `=password=12345678`, // Default password jika hilang dari mikrotik
          `=service=pppoe`,
          u.profile ? `=profile=${u.profile}` : "=profile=default",
          u.remoteAddress ? `=remote-address=${u.remoteAddress}` : "",
          u.localAddress ? `=local-address=${u.localAddress}` : "",
          u.keterangan ? `=comment=${u.keterangan}` : "",
        ].filter(Boolean));
        createdUsers++;
      }
    }

    // Mulai realtime loop jika belum jalan
    this.startAutoRealtime();

    return {
      success: true,
      totalUsers: secrets?.length || 0,
      createdUsers,
      updatedUsers,
      createdProfiles,
      updatedProfiles,
      realtime: true,
    };
  }

  /* =========================
     ACTIVE USERS (CACHE SAFE)
  ========================= */
  async getActiveUsers() {
    const now = Date.now();
    if (now - this.cacheTime < this.cacheTTL) return this.cacheActive;

    const connected = await this.connect();
    if (!connected) return this.cacheActive; // Kembalikan cache terakhir

    const data = await this.write("/ppp/active/print");
    this.cacheActive = data || [];
    this.cacheTime = now;
    return this.cacheActive;
  }

  /* =========================
     TRAFFIC
  ========================= */
  async getInterfaceTraffic(interfaceName) {
    try {
      const t = await this.write(
        "/interface/monitor-traffic",
        [`=interface=${interfaceName}`, "=once"]
      );
      const x = t?.[0] || {};
      return {
        rx: Number(x["rx-bits-per-second"] || 0),
        tx: Number(x["tx-bits-per-second"] || 0),
      };
    } catch {
      return { rx: 0, tx: 0 };
    }
  }

  /* =========================
     REALTIME ENGINE (SAFE + AUTO-RECONNECT)
  ========================= */
  async updateRealtime() {
    if (this.updating) return;
    this.updating = true;

    try {
      // ─── Coba konek (auto-reconnect built-in) ───
      const connected = await this.connect();

      if (!connected) {
        // Belum bisa konek → set semua user offline di DB
        await prisma.pppoeUser.updateMany({
          where: { routerId: this.router.id },
          data: { isOnline: false },
        });

        // Broadcast semua user offline ke frontend
        const users = await prisma.pppoeUser.findMany({
          where: { routerId: this.router.id },
          select: { id: true, username: true, profile: true, keterangan: true, lastSeen: true },
        });

        const offlineUsers = users.map(u => ({
          id: u.id,
          username: u.username,
          profile: u.profile,
          keterangan: u.keterangan || "",
          isOnline: false,
          uptime: null,
          downtime: u.lastSeen
            ? formatDuration(Date.now() - new Date(u.lastSeen).getTime())
            : null,
          lastSeen: u.lastSeen,
          rxBps: 0, txBps: 0,
          rxHuman: "0 bps", txHuman: "0 bps",
          localAddress: null, remoteAddress: null,
        }));

        broadcast({
          type: "pppoe-realtime",
          routerId: this.router.id,
          data: serialize(offlineUsers),
          ts: Date.now(),
        });

        return;
      }

      // ─── Ambil active users dari Mikrotik ───
      const activeUsers = await this.getActiveUsers();

      const activeMap = {};
      for (const a of activeUsers) {
        // Gunakan normalizeKey untuk konsistensi matching
        activeMap[normalizeKey(a.name)] = a;
      }

      const users = await prisma.pppoeUser.findMany({
        where: { routerId: this.router.id },
      });

      const realtimeUsers = [];
      for (const user of users) {
        const active = activeMap[normalizeKey(user.username)];
        let rx = 0, tx = 0;

        if (active) {
          try {
            let iface = active.interface || `<pppoe-${user.username}>`;
            let traffic = await this.getInterfaceTraffic(iface);
            if (traffic.rx === 0 && traffic.tx === 0) {
              const fallbackIface = `pppoe-${user.username}`;
              const fallbackTraffic = await this.getInterfaceTraffic(fallbackIface);
              if (fallbackTraffic.rx > 0 || fallbackTraffic.tx > 0) {
                traffic = fallbackTraffic;
              }
            }
            rx = traffic.rx;
            tx = traffic.tx;
          } catch { }
        }

        // Update DB
        const updatedUser = await prisma.pppoeUser.update({
          where: { id: user.id },
          data: {
            isOnline: !!active,
            localAddress: user.localAddress || null,
            remoteAddress: active?.address || user.remoteAddress || null,
            lastSeen: active ? new Date() : user.lastSeen,
            lastDisconnect: (!active && user.isOnline) ? new Date() : user.lastDisconnect,
          },
        });

        let downtime = "-";
        if (!active) {
          const refTime = updatedUser.lastDisconnect || updatedUser.lastSeen;
          if (refTime) {
            downtime = formatDuration(Date.now() - new Date(refTime).getTime());
          } else {
            downtime = "Offline";
          }
        }

        realtimeUsers.push({
          id: user.id,
          username: user.username,
          profile: user.profile,
          keterangan: user.keterangan || "",
          isOnline: !!active,
          uptime: active?.uptime || null,
          downtime,
          lastSeen: updatedUser.lastSeen,
          lastDisconnect: updatedUser.lastDisconnect,
          rxBps: rx, txBps: tx,
          rxHuman: formatBandwidth(rx),
          txHuman: formatBandwidth(tx),
          localAddress: user.localAddress || null,
          remoteAddress: active?.address || user.remoteAddress || null,
          latitude: user.latitude ?? null,
          longitude: user.longitude ?? null,
          topologyNodeId: user.topologyNodeId ?? null,
        });
      }

      broadcast({
        type: "pppoe-realtime",
        routerId: this.router.id,
        data: serialize(realtimeUsers),
        ts: Date.now(),
      });

      // ─── Cascade Topology Status ───
      const now = Date.now();
      if (!this.topologyNodesCache || (now - this.topologyNodesCacheTime > this.topologyNodesCacheTTL)) {
        this.topologyNodesCache = await prisma.topologyNode.findMany({
          include: {
            clients: { where: { routerId: this.router.id }, select: { id: true } },
            outgoingLinks: { select: { toNodeId: true } },
          }
        });
        this.topologyNodesCacheTime = now;
      }

      const nodes = this.topologyNodesCache;
      const rtUserMap = {};
      for (const ru of realtimeUsers) { rtUserMap[ru.id] = ru; }

      const nodeStatus = {};
      const oDCs = [];

      nodes.forEach(n => {
        if (n.type === "ODC") oDCs.push(n);
        let onlineClients = 0;
        const totalClients = n.clients.length;
        n.clients.forEach(c => {
          const rt = rtUserMap[c.id];
          if (rt && rt.isOnline) onlineClients++;
        });
        nodeStatus[n.id] = {
          id: n.id, name: n.name, type: n.type,
          totalClients, onlineClients,
          status: totalClients === 0 ? "UNKNOWN" : "ONLINE",
          reason: totalClients === 0 ? "Belum Ada Pelanggan" : "Normal",
          latitude: n.latitude, longitude: n.longitude,
        };
        if (totalClients > 0 && onlineClients === 0) {
          nodeStatus[n.id].status = "OFFLINE";
          nodeStatus[n.id].reason = "Kabel Drop / ODP Putus";
        }
      });

      oDCs.forEach(odc => {
        const childrenIds = odc.outgoingLinks.map(l => l.toNodeId);
        let allChildrenOffline = true, hasChildren = false;
        childrenIds.forEach(cid => {
          if (nodeStatus[cid] && nodeStatus[cid].totalClients > 0) {
            hasChildren = true;
            if (nodeStatus[cid].status === "ONLINE") allChildrenOffline = false;
          }
        });
        if (nodeStatus[odc.id].totalClients > 0 && nodeStatus[odc.id].onlineClients > 0) {
          allChildrenOffline = false;
        }
        if (hasChildren && allChildrenOffline) {
          nodeStatus[odc.id].status = "OFFLINE";
          nodeStatus[odc.id].reason = "Kabel Backbone ODC Putus";
          childrenIds.forEach(cid => {
            if (nodeStatus[cid] && nodeStatus[cid].status === "OFFLINE") {
              nodeStatus[cid].reason = `ODC Utama (${odc.name}) Mati`;
            }
          });
        }
      });

      broadcast({
        type: "topology-status-realtime",
        routerId: this.router.id,
        data: Object.values(nodeStatus),
        ts: Date.now(),
      });

    } catch (err) {
      console.error(`[PPPoE][${this.router.host}] Realtime error:`, err.message);
      // Reset koneksi agar loop berikutnya akan mencoba reconnect
      this.isConnected = false;
    } finally {
      this.updating = false;
    }
  }

  /* =========================
     AUTO LOOP + AUTO-RECONNECT
  ========================= */
  startAutoRealtime() {
    if (this.isRunning) return; // Jangan start duplikat

    this.isRunning = true;
    console.log(`[PPPoE][${this.router.host}] 🚀 Realtime loop dimulai.`);

    // Jalankan langsung pertama kali
    this.updateRealtime().catch(console.error);

    this.interval = setInterval(() => {
      this.updateRealtime().catch(console.error);
    }, 3000); // Cek setiap 3 detik
  }

  stopAutoRealtime() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.isRunning = false;
    console.log(`[PPPoE][${this.router.host}] ⏹️ Realtime loop dihentikan.`);
  }
}

module.exports = PppoeService;