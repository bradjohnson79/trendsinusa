-- CreateEnum
CREATE TYPE "SystemCommandType" AS ENUM ('AMAZON_PRODUCTS_REFRESH', 'AMAZON_DEALS_REFRESH');

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "approved" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "SystemCommand" (
    "id" TEXT NOT NULL,
    "type" "SystemCommandType" NOT NULL,
    "siteKey" TEXT NOT NULL DEFAULT 'trendsinusa',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "status" "IngestionStatus" NOT NULL DEFAULT 'STARTED',
    "error" TEXT,
    "metadata" JSONB,

    CONSTRAINT "SystemCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemCommand_type_siteKey_requestedAt_idx" ON "SystemCommand"("type", "siteKey", "requestedAt");

-- CreateIndex
CREATE INDEX "SystemCommand_status_requestedAt_idx" ON "SystemCommand"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "Deal_approved_suppressed_expiresAt_idx" ON "Deal"("approved", "suppressed", "expiresAt");
