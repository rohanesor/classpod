-- CreateEnum
CREATE TYPE "AttendanceSessionStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "AttendanceDecisionStatus" AS ENUM ('PENDING', 'CHECKED_IN', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "AttendanceSession" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "duration" INTEGER NOT NULL DEFAULT 90,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceDecision" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceDecisionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "AttendanceDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceSession_podId_idx" ON "AttendanceSession"("podId");

-- CreateIndex
CREATE INDEX "AttendanceSession_teacherId_idx" ON "AttendanceSession"("teacherId");

-- CreateIndex
CREATE INDEX "AttendanceSession_status_idx" ON "AttendanceSession"("status");

-- CreateIndex
CREATE INDEX "AttendanceDecision_sessionId_idx" ON "AttendanceDecision"("sessionId");

-- CreateIndex
CREATE INDEX "AttendanceDecision_studentId_idx" ON "AttendanceDecision"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDecision_sessionId_studentId_key" ON "AttendanceDecision"("sessionId", "studentId");

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDecision" ADD CONSTRAINT "AttendanceDecision_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDecision" ADD CONSTRAINT "AttendanceDecision_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
