-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TEKNISI');

-- CreateEnum
CREATE TYPE "PortType" AS ENUM ('ODC', 'ODP');

-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('NONE', 'ODC', 'ODP', 'USER');

-- CreateEnum
CREATE TYPE "SplitRatio" AS ENUM ('ONE_TO_2', 'ONE_TO_4', 'ONE_TO_8', 'ONE_TO_16', 'ONE_TO_32', 'ONE_TO_64');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlacklistedToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlacklistedToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Router" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 8728,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Router_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Olt" (
    "id" SERIAL NOT NULL,
    "routerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Olt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OltPort" (
    "id" SERIAL NOT NULL,
    "oltId" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OltPort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Odc" (
    "id" SERIAL NOT NULL,
    "oltPortId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "splitRatio" "SplitRatio" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Odc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OdcPort" (
    "id" SERIAL NOT NULL,
    "odcId" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "connectionType" "ConnectionType" NOT NULL DEFAULT 'NONE',
    "connectedOdcId" INTEGER,
    "connectedOdpId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OdcPort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Odp" (
    "id" SERIAL NOT NULL,
    "odcId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "splitRatio" "SplitRatio" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Odp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OdpPort" (
    "id" SERIAL NOT NULL,
    "odpId" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OdpPort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PppoeUser" (
    "id" SERIAL NOT NULL,
    "routerId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "odpPortId" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" TIMESTAMP(3),
    "lastDisconnect" TIMESTAMP(3),
    "localAddress" TEXT,
    "remoteAddress" TEXT,
    "profile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PppoeUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PppoeProfile" (
    "id" SERIAL NOT NULL,
    "routerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "localAddress" TEXT,
    "remoteAddress" TEXT,
    "rateLimit" TEXT,
    "burstLimit" TEXT,
    "burstThreshold" TEXT,
    "burstTime" TEXT,
    "onlyOne" BOOLEAN,
    "sessionTimeout" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PppoeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BlacklistedToken_token_key" ON "BlacklistedToken"("token");

-- CreateIndex
CREATE INDEX "Router_isOnline_idx" ON "Router"("isOnline");

-- CreateIndex
CREATE UNIQUE INDEX "OltPort_oltId_index_key" ON "OltPort"("oltId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "Odc_oltPortId_key" ON "Odc"("oltPortId");

-- CreateIndex
CREATE INDEX "Odc_oltPortId_idx" ON "Odc"("oltPortId");

-- CreateIndex
CREATE UNIQUE INDEX "OdcPort_odcId_index_key" ON "OdcPort"("odcId", "index");

-- CreateIndex
CREATE INDEX "Odp_odcId_idx" ON "Odp"("odcId");

-- CreateIndex
CREATE UNIQUE INDEX "OdpPort_odpId_index_key" ON "OdpPort"("odpId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "PppoeUser_odpPortId_key" ON "PppoeUser"("odpPortId");

-- CreateIndex
CREATE INDEX "PppoeUser_odpPortId_idx" ON "PppoeUser"("odpPortId");

-- CreateIndex
CREATE UNIQUE INDEX "PppoeUser_routerId_username_key" ON "PppoeUser"("routerId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "PppoeProfile_routerId_name_key" ON "PppoeProfile"("routerId", "name");

-- AddForeignKey
ALTER TABLE "Olt" ADD CONSTRAINT "Olt_routerId_fkey" FOREIGN KEY ("routerId") REFERENCES "Router"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OltPort" ADD CONSTRAINT "OltPort_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "Olt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Odc" ADD CONSTRAINT "Odc_oltPortId_fkey" FOREIGN KEY ("oltPortId") REFERENCES "OltPort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdcPort" ADD CONSTRAINT "OdcPort_odcId_fkey" FOREIGN KEY ("odcId") REFERENCES "Odc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Odp" ADD CONSTRAINT "Odp_odcId_fkey" FOREIGN KEY ("odcId") REFERENCES "Odc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdpPort" ADD CONSTRAINT "OdpPort_odpId_fkey" FOREIGN KEY ("odpId") REFERENCES "Odp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PppoeUser" ADD CONSTRAINT "PppoeUser_routerId_fkey" FOREIGN KEY ("routerId") REFERENCES "Router"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PppoeUser" ADD CONSTRAINT "PppoeUser_odpPortId_fkey" FOREIGN KEY ("odpPortId") REFERENCES "OdpPort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PppoeProfile" ADD CONSTRAINT "PppoeProfile_routerId_fkey" FOREIGN KEY ("routerId") REFERENCES "Router"("id") ON DELETE CASCADE ON UPDATE CASCADE;
