const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const PppoeService = require("../../services/admin/PppoeService");

const services = {};
let _monitoring = null;
const getMonitoring = () => {
  if (!_monitoring) _monitoring = require("../../services/admin/monitoring");
  return _monitoring;
};

const getService = (router) => {
  try {
    const mon = getMonitoring();
    if (mon.getPppoeService) return mon.getPppoeService(router);
  } catch { }
  if (!services[router.id]) {
    services[router.id] = new PppoeService(router);
  }
  return services[router.id];
};

// ─── Helper Sync Profil ke Semua Mikrotik & Putuskan Sesi Aktif ──────────────
async function syncProfileToRouters(profileName, rateLimit) {
  if (!profileName) return;
  try {
    const routers = await prisma.router.findMany();
    for (const router of routers) {
      try {
        const service = getService(router);
        const connected = await service.connect();
        if (!connected) continue;

        const targetRate = rateLimit && rateLimit !== "LOSS" ? rateLimit : "";

        // 1. Cek & update profile di Mikrotik
        const profiles = await service.write("/ppp/profile/print", [`?name=${profileName}`]);
        if (profiles && profiles.length > 0) {
          const existingProfile = profiles[0];
          if ((existingProfile["rate-limit"] || "") !== targetRate) {
            await service.write("/ppp/profile/set", [
              `=.id=${existingProfile[".id"]}`,
              `=rate-limit=${targetRate}`
            ]);
            console.log(`[Mikrotik][${router.host}] Profil ${profileName} diupdate rate-limit menjadi ${targetRate || "LOSS"}`);
          }
        } else {
          const params = [`=name=${profileName}`];
          if (targetRate) params.push(`=rate-limit=${targetRate}`);
          await service.write("/ppp/profile/add", params);
          console.log(`[Mikrotik][${router.host}] Profil ${profileName} dibuat dengan rate-limit ${targetRate || "LOSS"}`);
        }

        // 2. Putuskan active session yang menggunakan profile ini agar langsung reconnect dengan speed baru!
        const actives = await service.write("/ppp/active/print");
        const usersWithProfile = await prisma.pppoeUser.findMany({
          where: { routerId: router.id, profile: profileName },
          select: { username: true }
        });
        const usernames = new Set(usersWithProfile.map(u => u.username));

        for (const act of actives || []) {
          if (usernames.has(act.name)) {
            await service.write("/ppp/active/remove", [`=.id=${act[".id"]}`]);
            console.log(`[Mikrotik][${router.host}] Active session ${act.name} diputus untuk apply speed baru.`);
          }
        }
      } catch (err) {
        console.error(`[Mikrotik][${router.host}] Gagal sync profil ${profileName}:`, err.message);
      }
    }
  } catch (err) {
    console.error("Gagal syncProfileToRouters:", err.message);
  }
}

// ─── Seed default profiles jika belum ada ─────────────────────────────────────
const DEFAULT_PROFILES = [
  { name: "5 Mbps",  rateLimit: "5M/5M",   description: "Paket 5 Mbps" },
  { name: "10 Mbps", rateLimit: "10M/10M",  description: "Paket 10 Mbps" },
  { name: "15 Mbps", rateLimit: "15M/15M",  description: "Paket 15 Mbps" },
  { name: "20 Mbps", rateLimit: "20M/20M",  description: "Paket 20 Mbps" },
];

// GET /speed-profiles — daftar semua profile
exports.getAll = async (req, res) => {
  try {
    // Auto-seed jika kosong
    const count = await prisma.speedProfile.count();
    if (count === 0) {
      await prisma.speedProfile.createMany({ data: DEFAULT_PROFILES });
    }

    const profiles = await prisma.speedProfile.findMany({
      orderBy: { createdAt: "asc" },
    });
    res.json({ success: true, data: profiles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /speed-profiles — buat profile baru
exports.create = async (req, res) => {
  try {
    const { name, rateLimit, description, isActive } = req.body;
    if (!name || !rateLimit) {
      return res.status(400).json({ success: false, message: "name dan rateLimit wajib diisi" });
    }

    const profile = await prisma.speedProfile.create({
      data: {
        name: name.trim(),
        rateLimit: rateLimit.trim(),
        description: description?.trim() || null,
        isActive: isActive !== false,
      },
    });

    // Sync ke Mikrotik & putus sesi aktif
    syncProfileToRouters(profile.name, profile.rateLimit).catch(() => {});

    res.status(201).json({ success: true, data: profile, message: "Profile berhasil dibuat" });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ success: false, message: "Nama profile sudah digunakan" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /speed-profiles/:id — update profile
exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, rateLimit, description, isActive } = req.body;

    const profile = await prisma.speedProfile.update({
      where: { id },
      data: {
        ...(name      ? { name: name.trim() }           : {}),
        ...(rateLimit ? { rateLimit: rateLimit.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(isActive  !== undefined   ? { isActive }    : {}),
      },
    });

    // Sync ke Mikrotik & putus sesi aktif
    syncProfileToRouters(profile.name, profile.rateLimit).catch(() => {});

    res.json({ success: true, data: profile, message: "Profile berhasil diperbarui" });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ success: false, message: "Nama profile sudah digunakan" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /speed-profiles/:id — hapus profile
exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.speedProfile.delete({ where: { id } });
    res.json({ success: true, message: "Profile berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
