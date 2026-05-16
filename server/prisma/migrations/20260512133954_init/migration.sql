-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TEKNISI');

-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('ODC', 'ODP');

-- CreateEnum
CREATE TYPE "SplitterType" AS ENUM ('SPLITTER_1_2', 'SPLITTER_1_4', 'SPLITTER_1_8', 'SPLITTER_1_16', 'SPLITTER_1_32', 'SPLITTER_1_64');

-- CreateEnum
CREATE TYPE "CableType" AS ENUM ('DROP_1_CORE', 'BACKBONE_1_CORE', 'BACKBONE_2_CORE', 'BACKBONE_4_CORE', 'BACKBONE_6_CORE', 'BACKBONE_8_CORE', 'BACKBONE_12_CORE', 'BACKBONE_24_CORE', 'BACKBONE_48_CORE', 'BACKBONE_72_CORE', 'BACKBONE_96_CORE');

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
CREATE TABLE "OltPort" (
    "id" SERIAL NOT NULL,
    "routerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "port" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OltPort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopologyNode" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "NodeType" NOT NULL,
    "oltPortId" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopologyNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopologyLink" (
    "id" SERIAL NOT NULL,
    "fromNodeId" INTEGER NOT NULL,
    "toNodeId" INTEGER NOT NULL,
    "cableType" "CableType" NOT NULL,
    "totalCore" INTEGER NOT NULL,
    "distanceMeter" DOUBLE PRECISION,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopologyLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiberCore" (
    "id" SERIAL NOT NULL,
    "linkId" INTEGER NOT NULL,
    "coreNumber" INTEGER NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "targetNodeId" INTEGER,
    "splitterOutputId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiberCore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Splitter" (
    "id" SERIAL NOT NULL,
    "nodeId" INTEGER NOT NULL,
    "name" TEXT,
    "type" "SplitterType" NOT NULL,
    "inputPort" INTEGER NOT NULL DEFAULT 1,
    "outputPort" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Splitter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitterOutput" (
    "id" SERIAL NOT NULL,
    "splitterId" INTEGER NOT NULL,
    "portNumber" INTEGER NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "targetNodeId" INTEGER,
    "clientId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SplitterOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PppoeUser" (
    "id" SERIAL NOT NULL,
    "routerId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "topologyNodeId" INTEGER,
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

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BlacklistedToken_token_key" ON "BlacklistedToken"("token");

-- CreateIndex
CREATE INDEX "Router_isOnline_idx" ON "Router"("isOnline");

-- CreateIndex
CREATE UNIQUE INDEX "OltPort_routerId_port_key" ON "OltPort"("routerId", "port");

-- CreateIndex
CREATE UNIQUE INDEX "FiberCore_linkId_coreNumber_key" ON "FiberCore"("linkId", "coreNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SplitterOutput_splitterId_portNumber_key" ON "SplitterOutput"("splitterId", "portNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PppoeUser_routerId_username_key" ON "PppoeUser"("routerId", "username");

-- AddForeignKey
ALTER TABLE "OltPort" ADD CONSTRAINT "OltPort_routerId_fkey" FOREIGN KEY ("routerId") REFERENCES "Router"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopologyNode" ADD CONSTRAINT "TopologyNode_oltPortId_fkey" FOREIGN KEY ("oltPortId") REFERENCES "OltPort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopologyLink" ADD CONSTRAINT "TopologyLink_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "TopologyNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopologyLink" ADD CONSTRAINT "TopologyLink_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "TopologyNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiberCore" ADD CONSTRAINT "FiberCore_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "TopologyLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiberCore" ADD CONSTRAINT "FiberCore_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "TopologyNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiberCore" ADD CONSTRAINT "FiberCore_splitterOutputId_fkey" FOREIGN KEY ("splitterOutputId") REFERENCES "SplitterOutput"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Splitter" ADD CONSTRAINT "Splitter_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "TopologyNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitterOutput" ADD CONSTRAINT "SplitterOutput_splitterId_fkey" FOREIGN KEY ("splitterId") REFERENCES "Splitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitterOutput" ADD CONSTRAINT "SplitterOutput_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "TopologyNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitterOutput" ADD CONSTRAINT "SplitterOutput_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PppoeUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PppoeUser" ADD CONSTRAINT "PppoeUser_routerId_fkey" FOREIGN KEY ("routerId") REFERENCES "Router"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PppoeUser" ADD CONSTRAINT "PppoeUser_topologyNodeId_fkey" FOREIGN KEY ("topologyNodeId") REFERENCES "TopologyNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
