const PppoeService = require("../../services/admin/PppoeService");

const prisma = require("../../utils/prisma");

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

  return `${num.toFixed(2)} ${
    units[i]
  }`;
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

      await service.syncUsers();

      await service.connect();

      const users =
        await prisma.pppoeUser.findMany(
          {
            where: {
              routerId,
            },

            orderBy: {
              username:
                "asc",
            },
          }
        );

      const activeUsers =
        await service.getActiveUsers();

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

        let rx = 0;
        let tx = 0;

        if (active) {
          const iface =
            active.interface ||
            `<pppoe-${u.username}>`;

          const t =
            await service.getInterfaceTraffic(
              iface
            );

          rx = t.rx;
          tx = t.tx;
        }

        result.push({
          id: u.id,

          username:
            u.username,

          profile:
            u.profile,

          isOnline:
            !!active,

          uptime:
            active?.uptime ||
            null,

          localAddress:
            active?.address ||
            null,

          remoteAddress:
            active?.[
              "remote-address"
            ] || null,

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
          .catch(() => {});
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