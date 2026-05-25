const { RouterOSAPI } = require("node-routeros");
const { PrismaClient } = require("@prisma/client");

const { broadcast } = require("../../utils/socket");
const { decrypt } = require("../../utils/crypto");

const PppoeProfileService = require("./PppoeProfileService");

const prisma = new PrismaClient();

/* =========================
   SERIALIZE SAFE
========================= */
const serialize = (obj) =>
  JSON.parse(
    JSON.stringify(obj, (_, v) =>
      typeof v === "bigint"
        ? v.toString()
        : v
    )
  );

/* =========================
   FORMAT BANDWIDTH
========================= */
function formatBandwidth(
  bps = 0
) {
  const value = Number(bps || 0);

  if (!value) return "0 bps";

  const units = [
    "bps",
    "Kbps",
    "Mbps",
    "Gbps",
    "Tbps",
  ];

  let i = 0;
  let num = value;

  while (
    num >= 1000 &&
    i < units.length - 1
  ) {
    num /= 1000;
    i++;
  }

  return `${num.toFixed(2)} ${
    units[i]
  }`;
}

/* =========================
   FORMAT DURATION
========================= */
function formatDuration(ms = 0) {
  const sec = Math.floor(ms / 1000);

  const d = Math.floor(sec / 86400);

  const h = Math.floor(
    (sec % 86400) / 3600
  );

  const m = Math.floor(
    (sec % 3600) / 60
  );

  const s = sec % 60;

  let out = "";

  if (d) out += `${d}d `;
  if (h) out += `${h}h `;
  if (m) out += `${m}m `;

  if (s || !out)
    out += `${s}s`;

  return out.trim();
}

/* =========================
   NORMALIZE KEY
========================= */
const normalizeKey = (
  name = ""
) =>
  String(name)
    .toLowerCase()
    .replace(/^pppoe-/, "")
    .replace(/^<pppoe-/, "")
    .replace(/>$/, "")
    .replace(/[<>]/g, "")
    .replace(/\s/g, "")
    .trim();

/* =========================
   PPPoE SERVICE
========================= */
class PppoeService {
  constructor(router) {
    this.router = router;

    const password = decrypt(
      router.password
    );

    this.client = new RouterOSAPI({
      host: router.host,
      user: router.username,
      password,
      port: router.port || 8728,
      timeout: 15000,
    });

    /* =========================
       EVENTS
    ========================= */
    this.client.on(
      "error",
      (err) => {
        console.error(
          "[RouterOS ERROR]",
          err.message
        );

        this.isConnected = false;
      }
    );

    this.client.on("close", () => {
      console.warn(
        "[RouterOS CLOSED]"
      );

      this.isConnected = false;
    });

    this.client.on(
      "timeout",
      () => {
        console.warn(
          "[RouterOS TIMEOUT]"
        );

        this.isConnected = false;
      }
    );

    this.isRunning = false;

    this.interval = null;

    this.updating = false;

    this.cacheActive = [];
    this.cacheTime = 0;
    this.cacheTTL = 1000;

    this.isConnected = false;

    this.profileService = null;
    this.profileInterval = null;
  }

  /* =========================
     CONNECT
  ========================= */
  async connect() {
    try {
      if (this.isConnected)
        return;

      await this.client.connect();

      this.isConnected = true;

      /* INIT PROFILE SERVICE */
      if (!this.profileService) {
        this.profileService =
          new PppoeProfileService(
            this.router,
            this.client
          );
      }
    } catch (e) {
      console.error(
        "[PPPoE] Router connect error:",
        e.message
      );

      this.isConnected = false;

      throw e;
    }
  }

  /* =========================
     CLOSE
  ========================= */
  async close() {
    try {
      await this.client.close();
    } catch {}

    this.isConnected = false;
  }

  /* =========================
     GET SECRET
  ========================= */
  async getSecret(username) {
    await this.connect();

    const result =
      await this.client.write(
        "/ppp/secret/print",
        [`?name=${username}`]
      );

    return result?.[0] || null;
  }

  /* =========================
     GET ALL USERS
  ========================= */
  async getUsers() {
    await this.connect();

    const users =
      await this.client.write(
        "/ppp/secret/print"
      );

    return serialize(users || []);
  }

  /* =========================
     GET USER DETAIL
  ========================= */
  async getUser(username) {
    await this.connect();

    const user =
      await this.getSecret(
        username
      );

    if (!user) {
      throw new Error(
        "PPPoE user not found"
      );
    }

    return serialize(user);
  }

  /* =========================
     ADD USER
  ========================= */
  async addUser(data) {
    await this.connect();

    const existing =
      await this.getSecret(
        data.name
      );

    if (existing) {
      throw new Error(
        "PPPoE user already exists"
      );
    }

    const params = [
      `=name=${data.name}`,
      `=password=${
        data.password || ""
      }`,
      `=service=${
        data.service ||
        "pppoe"
      }`,
      `=profile=${
        data.profile ||
        "default"
      }`,
      `=disabled=${
        data.disabled
          ? "yes"
          : "no"
      }`,
    ];

    /* OPTIONAL FIELD */
    if (data.comment)
      params.push(
        `=comment=${data.comment}`
      );

    if (data["caller-id"])
      params.push(
        `=caller-id=${
          data["caller-id"]
        }`
      );

    if (data["local-address"])
      params.push(
        `=local-address=${
          data["local-address"]
        }`
      );

    if (
      data["remote-address"]
    )
      params.push(
        `=remote-address=${
          data[
            "remote-address"
          ]
        }`
      );

    if (data.routes)
      params.push(
        `=routes=${data.routes}`
      );

    if (
      data["limit-bytes-in"]
    )
      params.push(
        `=limit-bytes-in=${
          data[
            "limit-bytes-in"
          ]
        }`
      );

    if (
      data["limit-bytes-out"]
    )
      params.push(
        `=limit-bytes-out=${
          data[
            "limit-bytes-out"
          ]
        }`
      );

    if (
      typeof data[
        "only-one"
      ] === "boolean"
    ) {
      params.push(
        `=only-one=${
          data["only-one"]
            ? "yes"
            : "no"
        }`
      );
    }

    if (data["rate-limit"])
      params.push(
        `=rate-limit=${
          data["rate-limit"]
        }`
      );

    if (
      data["address-list"]
    )
      params.push(
        `=address-list=${
          data["address-list"]
        }`
      );

    if (
      data[
        "remote-ipv6-prefix-pool"
      ]
    )
      params.push(
        `=remote-ipv6-prefix-pool=${
          data[
            "remote-ipv6-prefix-pool"
          ]
        }`
      );

    /* CREATE USER */
    await this.client.write(
      "/ppp/secret/add",
      params
    );

    /* SAVE DB */
    const user =
      await prisma.pppoeUser.create({
        data: {
          routerId:
            this.router.id,
          username: data.name,
          profile:
            data.profile ||
            "default",
          isOnline: false,
        },
      });

    return {
      success: true,
      message:
        "PPPoE user created",
      data: serialize(user),
    };
  }


  /* =========================
     DELETE USER
  ========================= */
  async deleteUser(username) {
    await this.connect();

    const secret =
      await this.getSecret(
        username
      );

    if (!secret) {
      throw new Error(
        "PPPoE user not found"
      );
    }

    /* REMOVE ACTIVE */
    const active =
      await this.client.write(
        "/ppp/active/print",
        [`?name=${username}`]
      );

    if (active?.length) {
      await this.client.write(
        "/ppp/active/remove",
        [
          `=.id=${
            active[0][".id"]
          }`,
        ]
      );
    }

    /* REMOVE SECRET */
    await this.client.write(
      "/ppp/secret/remove",
      [
        `=.id=${secret[".id"]}`,
      ]
    );

    /* REMOVE DB */
    await prisma.pppoeUser.deleteMany({
      where: {
        routerId:
          this.router.id,
        username,
      },
    });

    return {
      success: true,
      message:
        "PPPoE user deleted",
    };
  }


  /* =========================
     ACTIVE USERS CACHE
  ========================= */
  async getActiveUsers() {
    const now = Date.now();

    if (
      now - this.cacheTime <
      this.cacheTTL
    ) {
      return this.cacheActive;
    }

    await this.connect();

    const data =
      await this.client.write(
        "/ppp/active/print"
      );

    this.cacheActive =
      data || [];

    this.cacheTime = now;

    return this.cacheActive;
  }

  /* =========================
     TRAFFIC
  ========================= */
  async getInterfaceTraffic(
    interfaceName
  ) {
    try {
      const t =
        await this.client.write(
          "/interface/monitor-traffic",
          [
            `=interface=${interfaceName}`,
            "=once",
          ]
        );

      const x = t?.[0] || {};

      return {
        rx: Number(
          x[
            "rx-bits-per-second"
          ] || 0
        ),

        tx: Number(
          x[
            "tx-bits-per-second"
          ] || 0
        ),
      };
    } catch {
      return {
        rx: 0,
        tx: 0,
      };
    }
  }

  /* =========================
     SYNC USERS
  ========================= */
  async syncUsers() {
    await this.connect();

    const secrets =
      await this.client.write(
        "/ppp/secret/print"
      );

    let created = 0;
    let updated = 0;
    let deleted = 0;

    const routerUsernames = (
      secrets || []
    )
      .map((s) =>
        String(
          s.name || ""
        ).trim()
      )
      .filter(Boolean);

    const dbUsers =
      await prisma.pppoeUser.findMany(
        {
          where: {
            routerId:
              this.router.id,
          },
        }
      );

    /* CREATE / UPDATE */
    for (const s of secrets ||
      []) {
      const username = String(
        s.name || ""
      ).trim();

      if (!username)
        continue;

      const existing =
        dbUsers.find(
          (u) =>
            u.username ===
            username
        );

      if (existing) {
        await prisma.pppoeUser.update(
          {
            where: {
              id: existing.id,
            },
            data: {
              profile:
                s.profile ||
                null,
            },
          }
        );

        updated++;
      } else {
        await prisma.pppoeUser.create(
          {
            data: {
              routerId:
                this.router.id,

              username,

              profile:
                s.profile ||
                null,

              isOnline: false,
            },
          }
        );

        created++;
      }
    }

    /* DELETE USER */
    const deletedUsers =
      dbUsers.filter(
        (u) =>
          !routerUsernames.includes(
            u.username
          )
      );

    if (
      deletedUsers.length > 0
    ) {
      await prisma.pppoeUser.deleteMany(
        {
          where: {
            id: {
              in: deletedUsers.map(
                (u) => u.id
              ),
            },
          },
        }
      );

      deleted =
        deletedUsers.length;
    }

    this.startAutoRealtime();

    this.startAutoProfileSync();

    return {
      success: true,
      total:
        secrets?.length || 0,
      created,
      updated,
      deleted,
      realtime: true,
    };
  }

  /* =========================
     AUTO PROFILE SYNC
  ========================= */
  startAutoProfileSync() {
    if (
      this.profileInterval
    )
      return;

    this.profileService
      ?.syncProfiles()
      .catch(console.error);

    this.profileInterval =
      setInterval(() => {
        this.profileService
          ?.syncProfiles()
          .catch(
            console.error
          );
      }, 60000);
  }

  /* =========================
     REALTIME ENGINE
  ========================= */
  async updateRealtime() {
    if (this.updating)
      return;

    this.updating = true;

    try {
      await this.connect();

      const activeUsers =
        await this.getActiveUsers();

      const activeMap = {};

      for (const a of activeUsers) {
        activeMap[
          normalizeKey(a.name)
        ] = a;
      }

      const users =
        await prisma.pppoeUser.findMany(
          {
            where: {
              routerId:
                this.router.id,
            },
          }
        );

      const realtimeUsers =
        await Promise.all(
          users.map(
            async (user) => {
              const active =
                activeMap[
                  normalizeKey(
                    user.username
                  )
                ];

              let rx = 0;
              let tx = 0;

              if (active) {
                try {
                  const iface =
                    active.interface ||
                    `pppoe-${user.username}`;

                  const traffic =
                    await this.getInterfaceTraffic(
                      iface
                    );

                  rx =
                    traffic.rx;

                  tx =
                    traffic.tx;
                } catch {}
              }

              const updatedUser =
                await prisma.pppoeUser.update(
                  {
                    where: {
                      id: user.id,
                    },

                    data: {
                      isOnline:
                        !!active,

                      localAddress:
                        active?.address ||
                        null,

                      remoteAddress:
                        active?.[
                          "remote-address"
                        ] ||
                        null,

                      lastSeen:
                        active
                          ? new Date()
                          : user.lastSeen,
                    },
                  }
                );

              let downtime =
                null;

              if (
                !active &&
                updatedUser.lastSeen
              ) {
                const diff =
                  Date.now() -
                  new Date(
                    updatedUser.lastSeen
                  ).getTime();

                downtime =
                  formatDuration(
                    diff
                  );
              }

              return {
                id: user.id,

                username:
                  user.username,

                profile:
                  user.profile,
                  disabled:
                  user.disabled ?? false,

                isOnline:
                  !!active,

                uptime:
                  active?.uptime ||
                  null,

                downtime,

                lastSeen:
                  updatedUser.lastSeen,

                rxBps: rx,
                txBps: tx,

                rxHuman:
                  formatBandwidth(
                    rx
                  ),

                txHuman:
                  formatBandwidth(
                    tx
                  ),

                localAddress:
                  active?.address ||
                  null,

                remoteAddress:
                  active?.[
                    "remote-address"
                  ] || null,

                latitude:
                  user.latitude ??
                  null,

                longitude:
                  user.longitude ??
                  null,
              };
            }
          )
        );

      broadcast({
        type:
          "pppoe-realtime",

        routerId:
          this.router.id,

        data: serialize(
          realtimeUsers
        ),

        ts: Date.now(),
      });
    } catch (err) {
      console.error(
        "[PPPoE] Realtime error:",
        err.message
      );

      this.isConnected = false;
    } finally {
      this.updating = false;
    }
  }

  /* =========================
     AUTO REALTIME
  ========================= */
  startAutoRealtime() {
    if (this.isRunning)
      return;

    this.isRunning = true;

    this.updateRealtime().catch(
      console.error
    );

    this.interval = setInterval(
      () => {
        this.updateRealtime().catch(
          console.error
        );
      },
      2000
    );
  }

  /* =========================
     STOP REALTIME
  ========================= */
  stopAutoRealtime() {
    if (this.interval) {
      clearInterval(
        this.interval
      );
    }

    this.interval = null;

    this.isRunning = false;
  }
}

module.exports = PppoeService;