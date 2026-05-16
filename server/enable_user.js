const { RouterOSAPI } = require("node-routeros");
const { PrismaClient } = require("@prisma/client");
const { decrypt } = require("./src/utils/crypto");
require("dotenv").config();

const prisma = new PrismaClient();

async function enableUser() {
  const targetUser = "Rumah1";
  const user = await prisma.pppoeUser.findFirst({
    where: { username: targetUser },
    include: { router: true }
  });

  if (!user) {
    console.error("❌ User tidak ditemukan di database");
    process.exit(1);
  }

  console.log(`\n=== ENABLING USER: ${user.username} on Router ${user.router.name} ===`);
  const client = new RouterOSAPI({
    host: user.router.host,
    user: user.router.username,
    password: decrypt(user.router.password),
    port: user.router.port || 8728,
    timeout: 5000,
  });

  try {
    await client.connect();
    console.log("✅ Connected to Mikrotik");

    // 1. Cari ID Secret
    const secrets = await client.write("/ppp/secret/print", [`?name=${user.username}`]);
    if (secrets.length > 0) {
      const secretId = secrets[0][".id"];
      await client.write("/ppp/secret/set", ["=.id=" + secretId, "=disabled=no"]);
      console.log(`✅ User ${user.username} has been ENABLED in Secrets`);
    } else {
      console.warn("⚠️ User tidak ditemukan di Secrets Mikrotik");
    }

    // 2. Tendang sesi aktif jika ada (Force Re-connect)
    const active = await client.write("/ppp/active/print", [`?name=${user.username}`]);
    if (active.length > 0) {
      const activeId = active[0][".id"];
      await client.write("/ppp/active/remove", ["=.id=" + activeId]);
      console.log(`✅ Active session removed for ${user.username}`);
    }

    await client.close();
    console.log("\n🚀 Selesai! Silakan tunggu 10-30 detik agar ONT pelanggan melakukan Dial-Up otomatis.");
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
  process.exit();
}

enableUser();
