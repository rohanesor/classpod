-- CreateEnum
CREATE TYPE "GatewayNodeStatus" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "GatewayObservationType" AS ENUM ('BLE_DETECTED', 'PERSON_COUNT', 'HEARTBEAT');

-- CreateTable
CREATE TABLE "Gateway" (
    "id" TEXT NOT NULL,
    "classroom" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "GatewayNodeStatus" NOT NULL DEFAULT 'OFFLINE',
    "firmwareVersion" TEXT,
    "lastHeartbeat" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayObservation" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "sessionId" TEXT,
    "type" "GatewayObservationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatewayObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Gateway_status_idx" ON "Gateway"("status");

-- CreateIndex
CREATE INDEX "Gateway_classroom_idx" ON "Gateway"("classroom");

-- CreateIndex
CREATE INDEX "GatewayObservation_gatewayId_idx" ON "GatewayObservation"("gatewayId");

-- CreateIndex
CREATE INDEX "GatewayObservation_sessionId_idx" ON "GatewayObservation"("sessionId");

-- CreateIndex
CREATE INDEX "GatewayObservation_type_idx" ON "GatewayObservation"("type");

-- CreateIndex
CREATE INDEX "GatewayObservation_createdAt_idx" ON "GatewayObservation"("createdAt");

-- AddForeignKey
ALTER TABLE "GatewayObservation" ADD CONSTRAINT "GatewayObservation_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayObservation" ADD CONSTRAINT "GatewayObservation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
