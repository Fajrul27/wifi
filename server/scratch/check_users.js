const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.pppoeUser.findMany({
    where: { routerId: 1 },
    select: {
      id: true,
      username: true,
      isOnline: true,
      routerId: true
    }
  });
  console.log("Users on Router 1:");
  console.log(users);
  
  const router = await prisma.router.findUnique({
    where: { id: 1 },
    select: {
      id: true,
      name: true,
      isOnline: true
    }
  });
  console.log("Router 1 Status:");
  console.log(router);
}

main().catch(console.error).finally(() => prisma.$disconnect());
