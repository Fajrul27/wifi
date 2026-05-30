const { RouterOSAPI } = require("node-routeros");
const fs = require("fs");
const pLimit = require("p-limit");

const logDebug = (msg) => {
  try {
    fs.appendFileSync(
      "/mnt/data170/Project_wifi/projek_old/monitoring/server/pppoe_debug.log",
      `[${new Date().toISOString()}] ${msg}\n`
    );
  } catch {}
};

const { broadcast } = require("../../utils/socket");
const { decrypt } = require("../../utils/crypto");

const PppoeProfileService = require("./PppoeProfileService");

const prisma = require("../../utils/prisma");

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

  return `${num.toFixed(2)} ${units[i]
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
    // Track known online status to prevent duplicate log on status change
    this.knownOnlineStatus = new Map();

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

    this.cacheSecrets = [];
    this.cacheSecretsTime = 0;
    this.cacheSecretsTTL = 10000;

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
      // console.error(
      //   "[PPPoE] Router connect error:",
      //   e.message
      // );

      this.isConnected = false;

      throw e;
    }
  }

  /* =========================
     WRITE
  ========================= */
  async write(path, params) {
    await this.connect();
    return this.client.write(path, params);
  }

  /* =========================
     CLOSE
  ========================= */
  async close() {
    try {
      await this.client.close();
    } catch { }

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
     GET SUPPORTED KEYS
  ========================= */
  async getSupportedKeys() {
    if (this.supportedKeys) return this.supportedKeys;

    try {
      const secrets = await this.client.write("/ppp/secret/print", ["?#.limit=1"]);
      if (secrets && secrets.length > 0) {
        this.supportedKeys = Object.keys(secrets[0]);
        return this.supportedKeys;
      }
    } catch {}

    return [
      "name", "password", "service", "profile", "local-address",
      "remote-address", "routes", "limit-bytes-in", "limit-bytes-out", "comment", "disabled"
    ];
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

    const supportedKeys = await this.getSupportedKeys();

    const params = [
      `=name=${data.name}`,
      `=password=${data.password || ""}`,
      `=service=${data.service || "pppoe"}`,
      `=profile=${data.profile || "default"}`,
      `=disabled=${data.disabled ? "yes" : "no"}`,
    ];

    const addParam = (apiKey, bodyValue, isNumber = false) => {
      if (bodyValue !== undefined && supportedKeys.includes(apiKey)) {
        if (isNumber) {
          const val = String(bodyValue).trim();
          if (val !== "") {
            params.push(`=${apiKey}=${val}`);
          }
        } else {
          params.push(`=${apiKey}=${bodyValue}`);
        }
      }
    };

    if (data.comment) {
      params.push(`=comment=${data.comment}`);
    }

    addParam("caller-id", data["caller-id"]);
    addParam("local-address", data["local-address"]);
    addParam("remote-address", data["remote-address"]);
    addParam("routes", data.routes);
    addParam("limit-bytes-in", data["limit-bytes-in"], true);
    addParam("limit-bytes-out", data["limit-bytes-out"], true);

    if (data["only-one"] !== undefined && supportedKeys.includes("only-one")) {
      params.push(`=only-one=${data["only-one"] ? "yes" : "no"}`);
    }
    addParam("rate-limit", data["rate-limit"]);
    addParam("address-list", data["address-list"]);
    addParam("remote-ipv6-prefix-pool", data["remote-ipv6-prefix-pool"]);

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

    this.clearCache();

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
          `=.id=${active[0][".id"]
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

    this.clearCache();

    return {
      success: true,
      message:
        "PPPoE user deleted",
    };
  }


  /* =========================
     SECRETS CACHE
  ========================= */
  clearCache() {
    this.cacheVersion = (this.cacheVersion || 0) + 1;
    this.cacheSecretsTime = 0;
    this.cacheTime = 0;
    this.cacheSecrets = [];
    this.cacheActive = [];
  }

  async getSecretsCached() {
    const now = Date.now();

    if (now - this.cacheSecretsTime < this.cacheSecretsTTL && this.cacheSecrets?.length > 0) {
      return this.cacheSecrets;
    }

    if (this._fetchingSecrets) {
      return await this._fetchingSecrets;
    }

    this._fetchingSecrets = (async () => {
      const version = this.cacheVersion || 0;
      await this.connect();
      const data = await this.client.write("/ppp/secret/print");
      
      this._fetchingSecrets = null;

      if (version !== (this.cacheVersion || 0)) {
        // Cache was cleared while we were fetching (e.g. user updated).
        // This data is stale. Fetch again to ensure we don't return stale data.
        return await this.getSecretsCached();
      }

      this.cacheSecrets = data || [];
      this.cacheSecretsTime = Date.now();
      return this.cacheSecrets;
    })();

    return await this._fetchingSecrets;
  }

  /* =========================
     ACTIVE USERS CACHE
  ========================= */
  async getActiveUsers() {
    const now = Date.now();

    if (now - this.cacheTime < this.cacheTTL && this.cacheActive?.length > 0) {
      return this.cacheActive;
    }

    if (this._fetchingActive) {
      return await this._fetchingActive;
    }

    this._fetchingActive = (async () => {
      const version = this.cacheVersion || 0;
      await this.connect();
      const data = await this.client.write("/ppp/active/print");
      
      this._fetchingActive = null;

      if (version !== (this.cacheVersion || 0)) {
        // Cache was cleared while we were fetching (e.g. user updated/kicked).
        // This data is stale. Fetch again.
        return await this.getActiveUsers();
      }

      this.cacheActive = data || [];
      this.cacheTime = Date.now();
      return this.cacheActive;
    })();

    return await this._fetchingActive;
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
     MULTIPLE TRAFFIC (BULK) - SAFER METHOD
     ========================= */
  async getMultipleInterfacesTraffic(interfaceNames) {
    if (!interfaceNames || interfaceNames.length === 0) {
      return {};
    }
    try {
      await this.connect();
      const trafficMap = {};
      
      // Use pLimit to limit concurrent RouterOS commands to prevent flooding
      const limit = pLimit(5);
      
      const promises = interfaceNames.map(iface => limit(async () => {
         try {
             const t = await this.client.write("/interface/monitor-traffic", [
               `=interface=${iface}`,
               "=once"
             ]);
             logDebug("updateRealtime: RAW MONITOR for " + iface + " = " + JSON.stringify(t));
             const x = t?.[0];
             if (x) {
                trafficMap[iface] = {
                  rx: Number(x["rx-bits-per-second"] || 0),
                  tx: Number(x["tx-bits-per-second"] || 0)
                };
             }
         } catch (e) {
             // Silently ignore if single interface fails (e.g. disconnected)
             trafficMap[iface] = { rx: 0, tx: 0 };
         }
      }));
      
      await Promise.all(promises);
      
      return trafficMap;
    } catch (err) {
      console.error("[PPPoE] Failed to get traffic for multiple interfaces:", err.message || String(err));
      return {};
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
      const deletedPortIds = deletedUsers.map(u => u.odpPortId).filter(Boolean);

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

      if (deletedPortIds.length > 0) {
        await prisma.odpPort.updateMany({
          where: { id: { in: deletedPortIds } },
          data: { isUsed: false }
        });
      }

      deleted =
        deletedUsers.length;
    }

    // Cleanup ghost ports (ports marked isUsed but no PppoeUser is attached)
    try {
      const ghostPorts = await prisma.odpPort.findMany({
        where: {
          isUsed: true,
          user: null
        }
      });

      if (ghostPorts.length > 0) {
        await prisma.odpPort.updateMany({
          where: { id: { in: ghostPorts.map(p => p.id) } },
          data: { isUsed: false }
        });
      }
    } catch (e) {
      console.error("Failed to cleanup ghost ports", e);
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
    logDebug("updateRealtime: called, isRunning=" + this.isRunning + ", updating=" + this.updating);
    if (this.updating)
      return;

    this.updating = true;

    try {
      logDebug("updateRealtime: connecting...");
      await this.connect();
      try {
        const sampleSecret = await this.client.write("/ppp/secret/print");
        logDebug("SAMPLE SECRET: " + JSON.stringify(sampleSecret?.[0], null, 2));
      } catch (err) {
        logDebug("SAMPLE SECRET ERROR: " + err.message);
      }
      logDebug("updateRealtime: connected! Fetching active users...");

      const activeUsers =
        await this.getActiveUsers();
      logDebug("updateRealtime: active users count=" + (activeUsers?.length || 0));

      const activeMap = {};

      for (const a of activeUsers) {
        const key = normalizeKey(a.name);
        activeMap[key] = a;
        logDebug("updateRealtime: activeMap key registered: " + key);
      }

      const secrets = await this.getSecretsCached();
      const secretMap = {};
      for (const s of secrets || []) {
        secretMap[normalizeKey(s.name)] = s;
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

      const activeInterfaces = [];
      for (const a of activeUsers) {
        const iface = a.interface || `<pppoe-${a.name}>`;
        if (iface) {
          activeInterfaces.push(iface);
        }
      }

      const trafficMap = await this.getMultipleInterfacesTraffic(activeInterfaces);
      logDebug("updateRealtime: trafficMap=" + JSON.stringify(trafficMap));

      const realtimeUsers =
        await Promise.all(
          users.map(
            async (user) => {
              const userKey = normalizeKey(user.username);
              const active = activeMap[userKey];
              logDebug("updateRealtime: user=" + user.username + " (key=" + userKey + ") active=" + !!active);

              const secret = secretMap[normalizeKey(user.username)];
              const disabled = secret ? (secret.disabled === "true" || secret.disabled === "yes" || secret.disabled === true) : false;

              let rx = 0;
              let tx = 0;

              if (active) {
                const iface = active.interface || `<pppoe-${active.name}>`;
                logDebug("updateRealtime: user=" + user.username + " iface=" + iface);
                if (iface && trafficMap[iface]) {
                  rx = trafficMap[iface].rx;
                  tx = trafficMap[iface].tx;
                } else {
                  logDebug("updateRealtime: iface not found in trafficMap!");
                }
              }

              const isOnline = !!active;
              const localAddress = active?.address || null;
              const remoteAddress = active?.address || null;
              const updatedLastSeen = isOnline ? new Date() : user.lastSeen;

              const needsDbUpdate =
                user.isOnline !== isOnline ||
                user.localAddress !== localAddress ||
                user.remoteAddress !== remoteAddress ||
                (isOnline && (!user.lastSeen || Date.now() - new Date(user.lastSeen).getTime() > 300000));

              let dbUser = user;
              if (needsDbUpdate) {
                try {
                  // Log only if this is a genuine status transition not yet recorded
                  const lastKnown = this.knownOnlineStatus.get(user.id);
                  if (lastKnown === undefined || lastKnown !== isOnline) {
                    this.knownOnlineStatus.set(user.id, isOnline);
                    const LogService = require("../../services/admin/LogService");
                    LogService.addLog(
                      `Client ${user.username} is now ${isOnline ? 'Online' : 'Offline'}`,
                      isOnline ? 'success' : 'danger'
                    ).catch(console.error);
                  }

                  dbUser = await prisma.pppoeUser.update({
                    where: { id: user.id },
                    data: {
                      isOnline,
                      localAddress,
                      remoteAddress,
                      lastSeen: updatedLastSeen
                    }
                  });
                  
                  // 🔥 FIX: Update the in-memory cache so it doesn't log again on next tick!
                  if (usersCache[this.router.id]) {
                    usersCache[this.router.id].set(user.id, dbUser);
                  }
                  
                  logDebug("updateRealtime: user=" + user.username + " updated in db");
                } catch (dbErr) {
                  console.error("[PPPoE DB Error]", dbErr.message);
                }
              }

              let downtime = null;
              if (!isOnline) {
                const baseTime = dbUser.lastSeen || dbUser.createdAt;
                if (baseTime) {
                  const diff = Date.now() - new Date(baseTime).getTime();
                  downtime = formatDuration(diff);
                }
              }

              return {
                id: user.id,
                username: user.username,
                profile: user.profile,
                disabled,
                isOnline,
                uptime: active?.uptime || null,
                downtime,
                lastSeen: dbUser.lastSeen,
                rxBps: rx,
                txBps: tx,
                rxHuman: formatBandwidth(rx),
                txHuman: formatBandwidth(tx),
                localAddress,
                remoteAddress,
                latitude: user.latitude ?? null,
                longitude: user.longitude ?? null,
              };
            }
          )
        );

       logDebug("updateRealtime: broadcasting " + realtimeUsers.length + " users");
      const serialized = serialize(realtimeUsers);
      broadcast({
        type:
          "pppoe-realtime",

        routerId:
          this.router.id,

        data: serialized,

        ts: Date.now(),
      });

      if (global.io) {
        const room = `router:${this.router.id}`;
        global.io.to(room).emit("pppoe-realtime", {
          type: "pppoe-realtime",
          routerId: this.router.id,
          data: serialized,
          ts: Date.now(),
        });
      }
      logDebug("updateRealtime: successfully finished!");
    } catch (err) {
      logDebug("updateRealtime: error: " + err.message + "\n" + err.stack);
      // console.error(
      //   "[PPPoE] Realtime error:",
      //   err.message
      // );

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