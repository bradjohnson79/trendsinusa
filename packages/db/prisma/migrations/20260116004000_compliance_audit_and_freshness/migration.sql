-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('SYSTEM', 'ADMIN', 'AI');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('PRODUCT', 'DEAL', 'PRICE', 'AI');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('PRICE_CHANGED', 'DEAL_CREATED', 'DEAL_UPDATED', 'DEAL_EXPIRED', 'AI_REWRITE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "sourceFetchedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" TEXT,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT,
    "action" "AuditAction" NOT NULL,
    "summary" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_occurredAt_idx" ON "AuditLog"("entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_occurredAt_idx" ON "AuditLog"("action", "occurredAt");

-- CreateIndex
CREATE INDEX "Product_sourceFetchedAt_idx" ON "Product"("sourceFetchedAt");
