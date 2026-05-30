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

      /* =========================
         CREATE / UPDATE
      ========================= */
      for (const p of profiles || []) {
        const data = this.normalizeProfile(p);

        if (!data.name) continue;

        routerProfileNames.push(data.name);

        const existing = dbProfiles.find(
          (x) => x.name === data.name
        );

        if (existing) {
          await prisma.pppoeProfile.update({
            where: {
              id: existing.id,
            },
            data,
          });

          updated++;
        } else {
          await prisma.pppoeProfile.create({
            data: {
              routerId: this.router.id,
              ...data,
            },
          });

          created++;
        }
      }

      /* =========================
         DELETE MISSING PROFILE
      ========================= */
      const deletedProfiles = dbProfiles.filter(
        (x) => !routerProfileNames.includes(x.name)
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