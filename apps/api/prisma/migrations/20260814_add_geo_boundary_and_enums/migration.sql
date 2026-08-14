-- AlterEnum
ALTER TYPE "AttendanceDecisionStatus" ADD VALUE 'PRESENT';
ALTER TYPE "AttendanceDecisionStatus" ADD VALUE 'NOT_PRESENT';

-- AlterEnum
ALTER TYPE "SignalSource" ADD VALUE 'GEOLOCATION';

-- AlterTable
ALTER TABLE "Pod" ADD COLUMN "geoBoundary" JSONB;

-- DropTable
DROP TABLE IF EXISTS "BiometricCredential";
