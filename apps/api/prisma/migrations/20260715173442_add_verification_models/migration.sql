-- CreateEnum
CREATE TYPE "SignalSource" AS ENUM ('CHECK_IN', 'BLE', 'PERSON_COUNT', 'MANUAL');

-- AlterTable
ALTER TABLE "AttendanceDecision" ADD COLUMN     "explanation" TEXT;

-- CreateTable
CREATE TABLE "VerificationSignal" (
    "id" TEXT NOT NULL,
    "attendanceDecisionId" TEXT NOT NULL,
    "source" "SignalSource" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationResult" (
    "id" TEXT NOT NULL,
    "attendanceDecisionId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationSignal_attendanceDecisionId_idx" ON "VerificationSignal"("attendanceDecisionId");

-- CreateIndex
CREATE INDEX "VerificationSignal_source_idx" ON "VerificationSignal"("source");

-- CreateIndex
CREATE INDEX "VerificationResult_attendanceDecisionId_idx" ON "VerificationResult"("attendanceDecisionId");

-- AddForeignKey
ALTER TABLE "VerificationSignal" ADD CONSTRAINT "VerificationSignal_attendanceDecisionId_fkey" FOREIGN KEY ("attendanceDecisionId") REFERENCES "AttendanceDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationResult" ADD CONSTRAINT "VerificationResult_attendanceDecisionId_fkey" FOREIGN KEY ("attendanceDecisionId") REFERENCES "AttendanceDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
