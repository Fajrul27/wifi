const { RouterOSAPI } = require("node-routeros");
const { PrismaClient } = require("@prisma/client");
const { decrypt } = require("./src/utils/crypto");
require("dotenv").config();

const prisma = new PrismaClient();

async function debugMikrotik() {
  const routers = await prisma.router.findMany();
  for (const r of routers) {
    console.log(`\n=== ROUTER: ${r.name} (${r.host}) ===`);
    const client = new RouterOSAPI({
      host: r.host,
      user: r.username,
      password: decrypt(r.password),
      port: r.port || 8728,
      timeout: 5000,
    });

    try {
      await client.connect();
      console.log("✅ Connected");

      const secrets = await client.write("/ppp/secret/print");
      console.log("--- SECRETS IN MIKROTIK ---");
      secrets.forEach(s => console.log(`- Name: [${s.name}], Profile: [${s.profile}], Last Logout: [${s['last-logged-out']}]`));

      const active = await client.write("/ppp/active/print");
      console.log("--- ACTIVE SESSIONS ---");
      if (active.length === 0) console.log("(None)");
      active.forEach(a => console.log(`- Name: [${a.name}], Address: [${a.address}], Uptime: [${a.uptime}]`));

      const logs = await client.write("/log/print", [".reverse", ".take=10"]);
      console.log("--- LATEST SYSTEM LOGS FROM MIKROTIK ---");
      logs.forEach(l => console.log(`- [${l.time}] ${l.topics}: ${l.message}`));

      await client.close();
    } catch (err) {
      console.error("❌ Error:", err.message);
    }
  }
  process.exit();
}

debugMikrotik();
