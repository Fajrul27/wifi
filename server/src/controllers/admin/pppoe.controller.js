const PppoeService = require("../../services/admin/PppoeService");
const prisma = require("../../utils/prisma");

const services = {};

// =========================
// SERIALIZE SAFE
// =========================
const serialize = (obj) =>
  JSON.parse(
    JSON.stringify(obj, (_, v) =>
      typeof v === "bigint" ? v.toString() : v
    )
  );

// =========================
// FORMAT BANDWIDTH
// =========================
function formatBandwidth(bps = 0) {
  const value = Number(bps || 0);
  if (!value) return "0 bps";

  const units = ["bps", "Kbps", "Mbps", "Gbps", "Tbps"];

  let i = 0;
  let num = value;

  while (num >= 1000 && i < units.length - 1) {
    num /= 1000;
    i++;
  }

  return `${num.toFixed(2)} ${units[i]}`;
}

// =========================
// NORMALIZE KEY
// =========================
const normalizeKey = (name = "") =>
  String(name)
    .toLowerCase()
    .replace(/^pppoe-/, "")
    .replace(/^<pppoe-/, "")
    .replace(/>$/, "")
    .replace(/\s/g, "")
    .trim();

// =========================
// SERVICE INSTANCE (Shared dengan monitoring.js)
// =========================
let _monitoring = null;
const getMonitoring = () => {
  if (!_monitoring) _monitoring = require("../services/admin/monitoring");
  return _monitoring;
};

const getService = (router) => {
  try {
    const mon = getMonitoring();
    if (mon.getPppoeService) return mon.getPppoeService(router);
  } catch { }
  // Fallback: buat instance baru jika monitoring belum ready
  if (!services[router.id]) {
    services[router.id] = new PppoeService(router);
  }
  return services[router.id];
};

// =========================
// GET ROUTER
// =========================
const getRouter = async (routerId) => {
  const router = await prisma.router.findUnique({
    where: { id: routerId },
  });

  if (!router) throw new Error("Router tidak ditemukan");
  return router;
};

// =========================
// CONTROLLER
// =========================
const controller = {};

// =========================
// SYNC USERS
// =========================
controller.sync = async (req, res) => {
  try {
    const router = await getRouter(Number(req.params.routerId));
    const service = getService(router);

    const result = await service.syncUsers();

    res.json({
      success: true,
      ...result,
      message: "Sync sukses + realtime aktif",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// =========================
// GET USERS (REALTIME + LOCATION READY)
// =========================
controller.getUsers = async (req, res) => {
  try {
    const routerId = Number(req.params.routerId);

    const router = await getRouter(routerId);
    const service = getService(router);

    const users = await prisma.pppoeUser.findMany({
      where: { routerId },
      orderBy: { username: "asc" },
    });

    await service.connect();

    const activeUsers = await service.getActiveUsers();

    const activeMap = {};
    for (const a of activeUsers) {
      // Gunakan normalizeKey agar konsisten dengan PppoeService
      activeMap[normalizeKey(a.name)] = a;
    }

    const result = [];

    for (const u of users) {
      // Gunakan normalizeKey agar konsisten dengan PppoeService
      const active = activeMap[normalizeKey(u.username)];

      let rx = 0;
      let tx = 0;

      if (active) {
        const iface =
  active.interface || `<pppoe-${u.username}>`;
        const t = await service.getInterfaceTraffic(iface);

        rx = t.rx;
        tx = t.tx;
      }

      result.push({
        id: u.id,
        username: u.username,
        profile: u.profile || null,

        isOnline: !!active,
        uptime: active?.uptime || null,

        localAddress: u.localAddress || null,
        remoteAddress: active?.address || u.remoteAddress || null,

        rxRaw: rx,
        txRaw: tx,
        rxHuman: formatBandwidth(rx),
        txHuman: formatBandwidth(tx),

        lastSeen: u.lastSeen,
        lastDisconnect: u.lastDisconnect ?? null,

        latitude: u.latitude ?? null,
        longitude: u.longitude ?? null,
        topologyNodeId: u.topologyNodeId ?? null,
      });
    }

    res.json({
      success: true,
      data: serialize(result),
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// =========================
// UPDATE LOCATION (EDIT SUPPORT)
// =========================
controller.updateLocation = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const { latitude, longitude } = req.body;

    const user = await prisma.pppoeUser.update({
      where: { id },
      data: {
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      },
    });

    // 🔥 OPTIONAL: langsung broadcast update biar realtime map ikut gerak
    const service = services[user.routerId];
    if (service?.updateRealtime) {
      service.updateRealtime().catch(() => {});
    }

    res.json({
      success: true,
      data: serialize(user),
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// =========================
// ACTIVE USERS
// =========================
controller.getActiveUsers = async (req, res) => {
  try {
    const router = await getRouter(Number(req.params.routerId));
    const service = getService(router);

    await service.connect();
    const data = await service.getActiveUsers();

    res.json({
      success: true,
      data: serialize(data),
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// =========================
// INTERFACE STATS
// =========================
controller.getInterfaceStats = async (req, res) => {
  try {
    const router = await getRouter(Number(req.params.routerId));
    const service = getService(router);

    await service.connect();

    const interfaces = await service.client.write("/interface/print");

    const result = [];

    for (const i of interfaces || []) {
      try {
        const t = await service.client.write(
          "/interface/monitor-traffic",
          [`=interface=${i.name}`, "=once"]
        );

        const x = t?.[0] || {};

        result.push({
          name: i.name,
          rxBps: Number(x["rx-bits-per-second"] || 0),
          txBps: Number(x["tx-bits-per-second"] || 0),
          rxHuman: formatBandwidth(x["rx-bits-per-second"] || 0),
          txHuman: formatBandwidth(x["tx-bits-per-second"] || 0),
        });

      } catch {}
    }

    res.json({
      success: true,
      data: serialize(result),
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// =========================
// STATUS REALTIME ENGINE
// =========================
controller.getRealtimeStatus = (req, res) => {
  const service = services[Number(req.params.routerId)];

  res.json({
    success: true,
    running: !!service?.isRunning,
    mode: service?.isRunning ? "mikrotik-realtime" : "stopped",
  });
};

// =========================
// GET PROFILES FROM MIKROTIK
// =========================
controller.getProfiles = async (req, res) => {
  try {
    const router = await getRouter(Number(req.params.routerId));
    const service = getService(router);
    const connected = await service.connect();
    if (!connected) throw new Error("Tidak dapat terhubung ke Mikrotik");

    const profiles = await service.client.write("/ppp/profile/print");

    const result = (profiles || []).map(p => ({
      name: p.name,
      rateLimit: p["rate-limit"] || null,
      localAddress: p["local-address"] || null,
      remoteAddress: p["remote-address"] || null,
      sessionTimeout: p["session-timeout"] || null,
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// =========================
// HELPER: ENSURE PROFILE EXISTS IN MIKROTIK & DB
// =========================
async function ensureProfileExists(service, profileName, customRateLimit = null) {
  if (!profileName || profileName === "default") return;
  try {
    // Cek di DB SpeedProfile
    let dbProfile = await prisma.speedProfile.findUnique({ where: { name: profileName } });
    
    // Jika belum ada di DB tapi ada customRateLimit dari input manual, kita otomatis simpan ke DB SpeedProfile!
    if (!dbProfile && customRateLimit) {
      dbProfile = await prisma.speedProfile.create({
        data: {
          name: profileName,
          rateLimit: customRateLimit,
          description: "Dibuat otomatis dari input manual PPPoE",
          isActive: true
        }
      });
    }

    const finalRate = customRateLimit || (dbProfile ? dbProfile.rateLimit : null);

    const profiles = await service.client.write("/ppp/profile/print", [`?name=${profileName}`]);
    if (profiles && profiles.length > 0) {
      const existingProfile = profiles[0];
      const currentRate = existingProfile["rate-limit"] || "";
      const targetRate = finalRate && finalRate !== "LOSS" ? finalRate : "";
      
      // Jika rate-limit di Mikrotik berbeda dengan target kita, UPDATE di Mikrotik!
      if (currentRate !== targetRate) {
        await service.client.write("/ppp/profile/set", [
          `=.id=${existingProfile[".id"]}`,
          `=rate-limit=${targetRate}`
        ]);
        console.log(`[Mikrotik] Profil ${profileName} diupdate rate-limit menjadi ${targetRate || "LOSS (tanpa limit)"}`);
      }
      return; // Selesai update profil yang sudah ada
    }

    const params = [`=name=${profileName}`];
    if (finalRate && finalRate !== "LOSS") {
      params.push(`=rate-limit=${finalRate}`);
    }
    
    // Create di Mikrotik
    await service.client.write("/ppp/profile/add", params);
  } catch (err) {
    console.error(`Gagal membuat profil ${profileName} di Mikrotik/DB:`, err.message);
  }
}

// =========================
// UPDATE USER FULL (Profile + Password + Lokasi sekaligus)
// =========================
controller.updateUserFull = async (req, res) => {
  try {
    const router = await getRouter(Number(req.params.routerId));
    const service = getService(router);

    const id = Number(req.params.id);
    const { password, profile, rateLimit, comment, keterangan, latitude, longitude, remoteAddress, localAddress } = req.body;

    const user = await prisma.pppoeUser.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ success: false, message: "User tidak ditemukan" });

    const finalComment = comment !== undefined ? comment : (keterangan !== undefined ? keterangan : undefined);

    // Update di Mikrotik jika ada yang berubah
    if (password || profile || finalComment !== undefined || remoteAddress !== undefined || localAddress !== undefined) {
      const connected = await service.connect();
      if (connected) {
        if (profile) await ensureProfileExists(service, profile, rateLimit); // PASTIKAN PROFIL ADA DI MIKROTIK & DB
        
        const secrets = await service.client.write("/ppp/secret/print", [`?name=${user.username}`]);
        const secret = secrets?.[0];
        if (secret) {
          const params = [`=.id=${secret[".id"]}`];
          if (password) params.push(`=password=${password}`);
          if (profile) params.push(`=profile=${profile}`);
          if (remoteAddress) params.push(`=remote-address=${remoteAddress}`);
          if (localAddress) params.push(`=local-address=${localAddress}`);
          if (finalComment !== undefined) params.push(`=comment=${finalComment}`);
          
          if (params.length > 1) {
            await service.client.write("/ppp/secret/set", params);
          }

          if (remoteAddress === "" || remoteAddress === null) {
            try {
              await service.client.write("/ppp/secret/unset", [`=.id=${secret[".id"]}`, `=value-name=remote-address`]);
            } catch (unsetErr) { console.error("Unset remote-address error:", unsetErr.message); }
          }
          if (localAddress === "" || localAddress === null) {
            try {
              await service.client.write("/ppp/secret/unset", [`=.id=${secret[".id"]}`, `=value-name=local-address`]);
            } catch (unsetErr) { console.error("Unset local-address error:", unsetErr.message); }
          }

          // PENTING: Selalu hapus active session saat user diupdate dari web agar Mikrotik mengambil antrean (queue) paling fresh!
          if (profile || remoteAddress !== undefined || localAddress !== undefined) {
            const actives = await service.client.write("/ppp/active/print", [`?name=${user.username}`]);
            const active = actives?.[0];
            if (active) {
              await service.client.write("/ppp/active/remove", [`=.id=${active[".id"]}`]);
              console.log(`[Mikrotik] Active session ${user.username} diputus untuk apply speed/IP fresh.`);
            }
          }
        }
      }
    }

    // Update di DB (profile + lokasi + keterangan + remoteAddress + localAddress)
    const updated = await prisma.pppoeUser.update({
      where: { id },
      data: {
        ...(profile ? { profile } : {}),
        ...(finalComment !== undefined ? { keterangan: finalComment } : {}),
        ...(remoteAddress !== undefined ? { remoteAddress: remoteAddress || null } : {}),
        ...(localAddress !== undefined ? { localAddress: localAddress || null } : {}),
        ...(latitude !== undefined ? { latitude: latitude === "" || latitude === null ? null : Number(latitude) } : {}),
        ...(longitude !== undefined ? { longitude: longitude === "" || longitude === null ? null : Number(longitude) } : {}),
      },
    });

    res.json({ success: true, data: serialize(updated), message: "User berhasil diperbarui" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// =========================
// CREATE USER (Mikrotik + DB)
// =========================
controller.createUser = async (req, res) => {
  try {
    const router = await getRouter(Number(req.params.routerId));
    const service = getService(router);
    await service.connect();

    const { username, password, profile, rateLimit, comment, keterangan, remoteAddress, localAddress } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username dan password wajib diisi" });
    }

    const finalComment = comment !== undefined ? comment : (keterangan !== undefined ? keterangan : "");

    // Buat di Mikrotik
    if (profile) await ensureProfileExists(service, profile, rateLimit); // PASTIKAN PROFIL ADA DI MIKROTIK & DB
    
    await service.client.write("/ppp/secret/add", [
      `=name=${username}`,
      `=password=${password}`,
      `=service=pppoe`,
      profile ? `=profile=${profile}` : "=profile=default",
      remoteAddress ? `=remote-address=${remoteAddress}` : "",
      localAddress ? `=local-address=${localAddress}` : "",
      finalComment ? `=comment=${finalComment}` : "",
    ].filter(Boolean));

    // Simpan ke DB
    const user = await prisma.pppoeUser.create({
      data: {
        routerId: router.id,
        username,
        profile: profile || null,
        remoteAddress: remoteAddress || null,
        localAddress: localAddress || null,
        keterangan: finalComment || null,
        isOnline: false,
      },
    });

    res.json({ success: true, data: serialize(user), message: "User berhasil ditambahkan" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// =========================
// UPDATE USER (Mikrotik + DB)
// =========================
controller.updateUser = async (req, res) => {
  try {
    const router = await getRouter(Number(req.params.routerId));
    const service = getService(router);
    await service.connect();

    const id = Number(req.params.id);
    const { password, profile, comment } = req.body;

    // Cari user di DB
    const user = await prisma.pppoeUser.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ success: false, message: "User tidak ditemukan" });

    // Cari .id Mikrotik berdasarkan username
    const secrets = await service.client.write("/ppp/secret/print", [
      `?name=${user.username}`,
    ]);
    const secret = secrets?.[0];
    if (!secret) return res.status(404).json({ success: false, message: "User tidak ditemukan di Mikrotik" });

    // Update di Mikrotik
    const params = [`=.id=${secret[".id"]}`];
    if (password) params.push(`=password=${password}`);
    if (profile) params.push(`=profile=${profile}`);
    if (comment !== undefined) params.push(`=comment=${comment}`);
    await service.client.write("/ppp/secret/set", params);

    // Update di DB
    const updated = await prisma.pppoeUser.update({
      where: { id },
      data: { profile: profile || user.profile },
    });

    res.json({ success: true, data: serialize(updated), message: "User berhasil diperbarui" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// =========================
// DELETE USER (Mikrotik + DB)
// =========================
controller.deleteUser = async (req, res) => {
  try {
    const router = await getRouter(Number(req.params.routerId));
    const service = getService(router);
    await service.connect();

    const id = Number(req.params.id);
    const user = await prisma.pppoeUser.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ success: false, message: "User tidak ditemukan" });

    // Cari .id Mikrotik
    const secrets = await service.client.write("/ppp/secret/print", [
      `?name=${user.username}`,
    ]);
    const secret = secrets?.[0];

    // Hapus dari Mikrotik jika ada
    if (secret) {
      await service.client.write("/ppp/secret/remove", [`=.id=${secret[".id"]}`]);
    }

    // Hapus dari DB
    await prisma.pppoeUser.delete({ where: { id } });

    res.json({ success: true, message: `User ${user.username} berhasil dihapus` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// =========================
// KICK USER (Putuskan sesi aktif)
// =========================
controller.kickUser = async (req, res) => {
  try {
    const router = await getRouter(Number(req.params.routerId));
    const service = getService(router);
    await service.connect();

    const id = Number(req.params.id);
    const user = await prisma.pppoeUser.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ success: false, message: "User tidak ditemukan" });

    // Cari sesi aktif di Mikrotik
    const actives = await service.client.write("/ppp/active/print", [
      `?name=${user.username}`,
    ]);
    const active = actives?.[0];

    if (!active) {
      return res.status(400).json({ success: false, message: "User tidak sedang online" });
    }

    await service.client.write("/ppp/active/remove", [`=.id=${active[".id"]}`]);

    res.json({ success: true, message: `Sesi ${user.username} berhasil diputus` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = controller;