/*
  Warnings:

  - Added the required column `name` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "passwordHash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "RequestLog" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "statusCode" INTEGER,
    "responseTime" INTEGER,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestLog_createdAt_idx" ON "RequestLog"("createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_requestId_idx" ON "RequestLog"("requestId");

-- CreateIndex
CREATE INDEX "RequestLog_correlationId_idx" ON "RequestLog"("correlationId");
