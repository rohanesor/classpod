-- CreateEnum
CREATE TYPE "PodStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'LEFT');

-- CreateTable
CREATE TABLE "Pod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectCode" TEXT NOT NULL,
    "description" TEXT,
    "joinCode" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "semester" TEXT,
    "section" TEXT,
    "status" "PodStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pod_joinCode_key" ON "Pod"("joinCode");

-- CreateIndex
CREATE INDEX "Pod_teacherId_idx" ON "Pod"("teacherId");

-- CreateIndex
CREATE INDEX "Pod_joinCode_idx" ON "Pod"("joinCode");

-- CreateIndex
CREATE INDEX "Enrollment_studentId_idx" ON "Enrollment"("studentId");

-- CreateIndex
CREATE INDEX "Enrollment_podId_idx" ON "Enrollment"("podId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_podId_studentId_key" ON "Enrollment"("podId", "studentId");

-- AddForeignKey
ALTER TABLE "Pod" ADD CONSTRAINT "Pod_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
