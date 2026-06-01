const prisma = require("../../utils/prisma");

class PppoeProfileService {
  constructor(router, client) {
    this.router = router;
    this.client = client;
  }

  /* =========================
     NORMALIZE
  ========================= */
normalizeProfile(profile) {
  return {
    name: String(profile.name || "").trim(),

    localAddress: profile["local-address"] || null,
    remoteAddress: profile["remote-address"] || null,

    rateLimit: profile["rate-limit"] || null,

    burstLimit: profile["burst-limit"] || null,
    burstThreshold: profile["burst-threshold"] || null,
    burstTime: profile["burst-time"] || null,

    onlyOne:
      profile["only-one"] === "yes" ||
      profile["only-one"] === true,

    sessionTimeout:
      profile["session-timeout"] || null,
  };
}

  /* =========================
     SYNC PPP PROFILE
  ========================= */
  async syncProfiles() {
    try {
      const profiles = await this.client.write(
        "/ppp/profile/print"
      );

      let created = 0;
      let updated = 0;
      let deleted = 0;

      // ambil profile DB
      const dbProfiles = await prisma.pppoeProfile.findMany({
        where: {
          routerId: this.router.id,
        },
      });

      // nama profile dari router
      const routerProfileNames = [];

      // Optimasi Map O(1) pencarian
      const dbProfileMap = new Map();
      for (const x of dbProfiles) {
        dbProfileMap.set(x.name, x);
      }

      const updates = [];
      const creates = [];

      /* =========================
         CREATE / UPDATE
      ========================= */
      for (const p of profiles || []) {
        const data = this.normalizeProfile(p);

        if (!data.name) continue;

        routerProfileNames.push(data.name);

        const existing = dbProfileMap.get(data.name);

        if (existing) {
          updates.push(
            prisma.pppoeProfile.update({
              where: {
                id: existing.id,
              },
              data,
            })
          );

          updated++;
        } else {
          creates.push({
            routerId: this.router.id,
            ...data,
          });

          created++;
        }
      }

      if (updates.length > 0 || creates.length > 0) {
        await prisma.$transaction([
          ...updates,
          ...(creates.length > 0 ? [prisma.pppoeProfile.createMany({ data: creates })] : [])
        ]);
      }

      /* =========================
         DELETE MISSING PROFILE
      ========================= */
      const routerProfileNameSet = new Set(routerProfileNames);
      const deletedProfiles = dbProfiles.filter(
        (x) => !routerProfileNameSet.has(x.name)
      );

      if (deletedProfiles.length > 0) {
        await prisma.pppoeProfile.deleteMany({
          where: {
            id: {
              in: deletedProfiles.map((x) => x.id),
            },
          },
        });

        deleted = deletedProfiles.length;
      }

      return {
        success: true,
        total: profiles.length,
        created,
        updated,
        deleted,
      };
    } catch (err) {
      console.error(
        "[PPPoE Profile Sync Error]",
        err.message
      );

      return {
        success: false,
        error: err.message,
      };
    }
  }
}

module.exports = PppoeProfileService;