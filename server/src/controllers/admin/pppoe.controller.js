const PppoeService = require("../../services/admin/PppoeService");

const { deleteImage } = require("../../utils/cloudinary");
const prisma = require("../../utils/prisma");
const { getRoadRoute } = require("../../utils/routing");

const services = {};

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
========================= */
const normalizeKey = (
  name = ""
) =>
  String(name)
    .toLowerCase()
    .replace(/^pppoe-/, "")
    .replace(/^<pppoe-/, "")
    .replace(/>$/, "")
    .replace(/\s/g, "")
    .trim();

/* =========================
   SERVICE INSTANCE
========================= */
const getService = (router) => {
  if (!services[router.id]) {
    services[router.id] =
      new PppoeService(router);
  }

  services[router.id].startAutoRealtime();

  return services[router.id];
};

/* =========================
   GET ROUTER
========================= */
const getRouter = async (
  routerId
) => {
  const router =
    await prisma.router.findUnique(
      {
        where: {
          id: routerId,
        },
      }
    );

  if (!router) {
    throw new Error(
      "Router tidak ditemukan"
    );
  }

  return router;
};

/* =========================
   CONTROLLER
========================= */
const controller = {};

/* =========================
   SYNC USERS
========================= */
controller.sync = async (
  req,
  res
) => {
  try {
    const router =
      await getRouter(
        Number(
          req.params.routerId
        )
      );

    const service =
      getService(router);

    const result =
      await service.syncUsers();

    res.json({
      success: true,
      ...result,
      message:
        "PPPoE sync + profile sync aktif",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* =========================
   GET PROFILES
========================= */
controller.getProfiles =
  async (req, res) => {
    try {
      const routerId =
        Number(
          req.params.routerId
        );

      const profiles =
        await prisma.pppoeProfile.findMany(
          {
            where: {
              routerId,
            },

            orderBy: {
              name: "asc",
            },
          }
        );

      res.json({
        success: true,
        data: serialize(
          profiles
        ),
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

/* =========================
   GET USERS
========================= */
controller.getUsers =
  async (req, res) => {
    try {
      const routerId =
        Number(
          req.params.routerId
        );

      const router =
        await getRouter(
          routerId
        );

      const service =
        getService(router);

      // Serve from background cache immediately if available! (Ultra-fast, non-blocking)
      if (service.cachedRealtimeUsers && service.cachedRealtimeUsers.length > 0) {
        return res.json({
          success: true,
          data: serialize(service.cachedRealtimeUsers),
        });
      }

      const users =
        await prisma.pppoeUser.findMany(
          {
            where: {
              routerId,
            },
            include: {
              odpPort: true,
            },
            orderBy: {
              username:
                "asc",
            },
          }
        );

      let activeUsers = [];
      let secretMap = {};
      let trafficMap = {};

      try {
        await service.connect();

        activeUsers = await service.getActiveUsers();

        // Fetch secrets to get disabled status
        const secrets = await service.getUsers();
        for (const s of secrets || []) {
          secretMap[normalizeKey(s.name)] = s;
        }

        const activeInterfaces = [];
        for (const a of activeUsers) {
          const iface = a.interface || `<pppoe-${a.name}>`;
          if (iface) {
            activeInterfaces.push(iface);
          }
        }

        trafficMap = await service.getMultipleInterfacesTraffic(activeInterfaces);
      } catch (connErr) {
        console.warn(`[Router Offline] Could not connect to Mikrotik router ID ${routerId}:`, connErr.message);
      }

      const activeMap = {};

      for (const a of activeUsers) {
        activeMap[
          normalizeKey(
            a.name
          )
        ] = a;
      }

      const result = [];

      for (const u of users) {
        const active =
          activeMap[
          normalizeKey(
            u.username
          )
          ];

        const secret = secretMap[normalizeKey(u.username)];
        const disabled = secret ? (secret.disabled === "true" || secret.disabled === "yes" || secret.disabled === true) : false;

        let rx = 0;
        let tx = 0;

        if (active) {
          const iface = active.interface || `<pppoe-${active.name}>`;
          if (iface && trafficMap[iface]) {
            rx = trafficMap[iface].rx;
            tx = trafficMap[iface].tx;
          }
        }

        let downtime = null;
        if (!active) {
          const baseTime = u.lastSeen || u.createdAt;
          if (baseTime) {
            const diff = Date.now() - new Date(baseTime).getTime();
            downtime = formatDuration(diff);
          }
        }

        const userObj = {
          id: u.id,
          routerId: u.routerId,

          username:
            u.username,

          profile:
            u.profile,

          isOnline:
            !!active,

          disabled,

          uptime:
            active?.uptime ||
            null,

          downtime,

          localAddress:
            active?.address ||
            null,

          remoteAddress:
            active?.address || null,

          rxRaw: rx,
          txRaw: tx,

          rxHuman:
            formatBandwidth(
              rx
            ),

          txHuman:
            formatBandwidth(
              tx
            ),

          lastSeen:
            u.lastSeen,

          latitude:
            u.latitude ??
            null,

          longitude:
            u.longitude ??
            null,

          whatsapp: u.whatsapp || null,
          address: u.address || null,
          photoUrl: u.photoUrl || null,
          photoUrl2: u.photoUrl2 || null,
          photoUrl3: u.photoUrl3 || null,

          topologyNodeId: u.odpPort?.odpId ? (u.odpPort.odpId + 100000) : null,
          roadCoordinates: null
        };

        if (u.roadCoordinates) {
          try {
            userObj.roadCoordinates = JSON.parse(u.roadCoordinates);
          } catch (e) {
            console.error("Failed to parse client roadCoordinates:", e);
          }
        }

        result.push(userObj);
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

/* =========================
   GET USER DETAIL
========================= */
controller.getUser =
  async (req, res) => {
    try {
      const router =
        await getRouter(
          Number(
            req.params.routerId
          )
        );

      const service =
        getService(router);

      const user =
        await service.getUser(
          req.params.username
        );

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

/* =========================
   ADD USER
========================= */
controller.addUser =
  async (req, res) => {
    try {
      const router =
        await getRouter(
          Number(
            req.params.routerId
          )
        );

      const service =
        getService(router);

      const result =
        await service.addUser(
          req.body
        );

      await service.syncUsers();

      res.json({
        success: true,
        ...serialize(result),
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };



/* =========================
   DELETE USER
========================= */
controller.deleteUser = async (req, res) => {
  try {
    const router = await getRouter(Number(req.params.routerId));
    const service = getService(router);

    const username = req.params.username; // 🔥 FIX UTAMA

    const result = await service.deleteUser(username);

    await service.syncUsers();

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
/* =========================
   UPDATE LOCATION
========================= */
controller.updateLocation =
  async (req, res) => {
    try {
      const id = Number(
        req.params.id
      );

      const {
        latitude,
        longitude,
      } = req.body;

      const user =
        await prisma.pppoeUser.update(
          {
            where: { id },

            data: {
              latitude:
                latitude ??
                null,

              longitude:
                longitude ??
                null,
            },
          }
        );

      /* BROADCAST REALTIME */
      const service =
        services[user.routerId];

      if (
        service?.updateRealtime
      ) {
        service
          .updateRealtime()
          .catch(() => { });
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

/* =========================
   GET ACTIVE USERS
========================= */
controller.getActiveUsers =
  async (req, res) => {
    try {
      const router =
        await getRouter(
          Number(
            req.params.routerId
          )
        );

      const service =
        getService(router);

      await service.connect();

      const data =
        await service.getActiveUsers();

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

/* =========================
   INTERFACE STATS
========================= */
controller.getInterfaceStats =
  async (req, res) => {
    try {
      const router =
        await getRouter(
          Number(
            req.params.routerId
          )
        );

      const service =
        getService(router);

      await service.connect();

      const interfaces =
        await service.client.write(
          "/interface/print"
        );

      const result = [];

      for (const i of interfaces ||
        []) {
        try {
          const t =
            await service.client.write(
              "/interface/monitor-traffic",
              [
                `=interface=${i.name}`,
                "=once",
              ]
            );

          const x =
            t?.[0] || {};

          result.push({
            name: i.name,

            rxBps: Number(
              x[
              "rx-bits-per-second"
              ] || 0
            ),

            txBps: Number(
              x[
              "tx-bits-per-second"
              ] || 0
            ),

            rxHuman:
              formatBandwidth(
                x[
                "rx-bits-per-second"
                ] || 0
              ),

            txHuman:
              formatBandwidth(
                x[
                "tx-bits-per-second"
                ] || 0
              ),
          });
        } catch { }
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

/* =========================
   UPDATE USER
========================= */
controller.updateUser = async (req, res) => {
  try {
    const router = await getRouter(Number(req.params.routerId));
    const service = getService(router);
    await service.connect();

    const username = req.params.username;

    // Get the .id of the user in MikroTik
    const secrets = await service.write("/ppp/secret/print", [
      `?name=${username}`,
    ]);
    const secret = secrets?.[0];
    if (!secret) {
      return res.status(404).json({ success: false, message: "User tidak ditemukan di Mikrotik" });
    }

    const supportedKeys = await service.getSupportedKeys();

    // Update in MikroTik
    const params = [`=.id=${secret[".id"]}`];
    
    if (req.body.password !== undefined) params.push(`=password=${req.body.password}`);
    if (req.body.profile !== undefined) params.push(`=profile=${req.body.profile}`);
    if (req.body.comment !== undefined) params.push(`=comment=${req.body.comment}`);
    if (req.body.disabled !== undefined) {
      params.push(`=disabled=${req.body.disabled ? "yes" : "no"}`);
    }

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

    addParam("service", req.body.service);
    addParam("local-address", req.body["local-address"]);
    addParam("remote-address", req.body["remote-address"]);
    addParam("caller-id", req.body["caller-id"]);
    addParam("routes", req.body.routes);
    addParam("limit-bytes-in", req.body["limit-bytes-in"], true);
    addParam("limit-bytes-out", req.body["limit-bytes-out"], true);
    
    // Only pass if supported
    if (req.body["only-one"] !== undefined && supportedKeys.includes("only-one")) {
      params.push(`=only-one=${req.body["only-one"] ? "yes" : "no"}`);
    }
    addParam("rate-limit", req.body["rate-limit"]);
    addParam("address-list", req.body["address-list"]);
    addParam("remote-ipv6-prefix-pool", req.body["remote-ipv6-prefix-pool"]);

    await service.write("/ppp/secret/set", params);

    // Terminate session if changed
    if (
      req.body.profile !== undefined ||
      req.body["remote-address"] !== undefined ||
      req.body["local-address"] !== undefined ||
      req.body.disabled === true
    ) {
      const actives = await service.write("/ppp/active/print", [
        `?name=${username}`,
      ]);
      const active = actives?.[0];
      if (active) {
        await service.write("/ppp/active/remove", [`=.id=${active[".id"]}`]);
      }
    }

    // Update in database cache
    const dbUpdateData = {};
    if (req.body.profile !== undefined) dbUpdateData.profile = req.body.profile;
    if (req.body["local-address"] !== undefined) dbUpdateData.localAddress = req.body["local-address"] || null;
    if (req.body["remote-address"] !== undefined) dbUpdateData.remoteAddress = req.body["remote-address"] || null;
    
    // Info Lapangan
    if (req.body.whatsapp !== undefined) dbUpdateData.whatsapp = req.body.whatsapp || null;
    if (req.body.address !== undefined) dbUpdateData.address = req.body.address || null;
    if (req.body.photoUrl !== undefined) dbUpdateData.photoUrl = req.body.photoUrl || null;
    if (req.body.photoUrl2 !== undefined) dbUpdateData.photoUrl2 = req.body.photoUrl2 || null;
    if (req.body.photoUrl3 !== undefined) dbUpdateData.photoUrl3 = req.body.photoUrl3 || null;
    const dbUser = await prisma.pppoeUser.findUnique({
      where: {
        routerId_username: {
          routerId: router.id,
          username,
        },
      },
      include: {
        odpPort: {
          include: {
            odp: true
          }
        }
      }
    });

    if (dbUser) {
      if (req.body.photoUrl !== undefined && dbUser.photoUrl && req.body.photoUrl !== dbUser.photoUrl) {
          deleteImage(dbUser.photoUrl);
      }
      if (req.body.photoUrl2 !== undefined && dbUser.photoUrl2 && req.body.photoUrl2 !== dbUser.photoUrl2) {
          deleteImage(dbUser.photoUrl2);
      }
      if (req.body.photoUrl3 !== undefined && dbUser.photoUrl3 && req.body.photoUrl3 !== dbUser.photoUrl3) {
          deleteImage(dbUser.photoUrl3);
      }

      let roadCoordsVal = req.body.roadCoordinates;
      const finalLat = req.body.latitude !== undefined ? (req.body.latitude === null || req.body.latitude === "" ? null : Number(req.body.latitude)) : (dbUser.latitude !== null ? Number(dbUser.latitude) : null);
      const finalLng = req.body.longitude !== undefined ? (req.body.longitude === null || req.body.longitude === "" ? null : Number(req.body.longitude)) : (dbUser.longitude !== null ? Number(dbUser.longitude) : null);
      
      const isMoved = (req.body.latitude !== undefined && Number(req.body.latitude) !== (dbUser.latitude !== null ? Number(dbUser.latitude) : null)) ||
                      (req.body.longitude !== undefined && Number(req.body.longitude) !== (dbUser.longitude !== null ? Number(dbUser.longitude) : null));

      if (roadCoordsVal === null || (isMoved && !req.body.roadCoordinates)) {
        let parentLat = null;
        let parentLng = null;
        const connectedOdp = dbUser.odpPort?.odp;
        if (connectedOdp && connectedOdp.latitude !== null && connectedOdp.longitude !== null) {
          parentLat = Number(connectedOdp.latitude);
          parentLng = Number(connectedOdp.longitude);
        }
        
        if (parentLat !== null && parentLng !== null && finalLat !== null && finalLng !== null) {
          const { getRoadRoute } = require("../../utils/routing");
          const coords = await getRoadRoute(parentLat, parentLng, finalLat, finalLng);
          if (coords) {
            roadCoordsVal = JSON.stringify(coords);
          }
        }
      }

      if (roadCoordsVal !== undefined) {
        dbUpdateData.roadCoordinates = roadCoordsVal;
      }
      
      await prisma.pppoeUser.update({
        where: {
          id: dbUser.id,
        },
        data: dbUpdateData,
      });
    }

    service.clearCache();

    // Log the action
    const LogService = require("../../services/admin/LogService");
    if (req.body.disabled !== undefined) {
      await LogService.addLog(`User ${username} was ${req.body.disabled ? 'disabled' : 'enabled'} by admin`, req.body.disabled ? 'warning' : 'success');
    } else {
      await LogService.addLog(`User ${username} profile/settings updated by admin`, 'info');
    }

    res.json({ success: true, message: "User berhasil diperbarui" });
  } catch (error) {
    console.error("[PPPoE Controller] Failed to update user:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================
   KICK USER SESSION
========================= */
controller.kickUser = async (req, res) => {
  try {
    const router = await getRouter(Number(req.params.routerId));
    const service = getService(router);
    await service.connect();

    const username = req.params.username;

    const actives = await service.write("/ppp/active/print", [
      `?name=${username}`,
    ]);
    const active = actives?.[0];

    if (!active) {
      return res.status(404).json({ success: false, message: "Session tidak ditemukan (mungkin sudah offline)" });
    }

    await service.write("/ppp/active/remove", [`=.id=${active[".id"]}`]);

    service.clearCache();

    // Log the action
    const LogService = require("../../services/admin/LogService");
    await LogService.addLog(`User session ${username} was reconnected by admin`, 'info');

    res.json({ success: true, message: "Session berhasil diputus" });
  } catch (error) {
    console.error("[PPPoE Controller] Failed to kick user:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================
   CLEAR SERVICE CACHE
========================= */
controller.clearService = (routerId) => {
  const service = services[routerId];
  if (service) {
    try {
      if (service.client) {
        service.client.close().catch(() => {});
      }
      service.isConnected = false;
    } catch (e) {
      console.error("[SERVICE CLEAR ERROR]", e);
    }
    delete services[routerId];
  }
};

/* =========================
   REALTIME STATUS
========================= */
controller.getRealtimeStatus =
  (req, res) => {
    const service =
      services[
      Number(
        req.params.routerId
      )
      ];

    res.json({
      success: true,

      running:
        !!service?.isRunning,

      mode:
        service?.isRunning
          ? "mikrotik-realtime"
          : "stopped",
    });
  };

module.exports = controller;