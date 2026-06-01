-- AlterTable
ALTER TABLE "Odc" ADD COLUMN     "address" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "whatsapp" TEXT;

-- AlterTable
ALTER TABLE "Odp" ADD COLUMN     "address" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "whatsapp" TEXT;

-- AlterTable
ALTER TABLE "PppoeUser" ADD COLUMN     "address" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "whatsapp" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "area" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "status" TEXT DEFAULT 'AKTIF';

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemLog_createdAt_idx" ON "SystemLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Odc_parentOdcId_idx" ON "Odc"("parentOdcId");

-- CreateIndex
CREATE INDEX "Odc_oltPortId_idx" ON "Odc"("oltPortId");

-- CreateIndex
CREATE INDEX "PppoeUser_routerId_isOnline_idx" ON "PppoeUser"("routerId", "isOnline");

-- CreateIndex
CREATE INDEX "PppoeUser_isOnline_idx" ON "PppoeUser"("isOnline");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");
