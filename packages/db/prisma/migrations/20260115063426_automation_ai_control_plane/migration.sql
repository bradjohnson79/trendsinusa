-- CreateEnum
CREATE TYPE "UrgencyTier" AS ENUM ('ONE_HOUR', 'SIX_HOUR', 'TWENTY_FOUR_HOUR');

-- CreateEnum
CREATE TYPE "AIEntityType" AS ENUM ('PRODUCT', 'DEAL', 'SEO', 'HERO');

-- CreateEnum
CREATE TYPE "AIActionType" AS ENUM ('RESEARCH', 'FINALIZE', 'SUPPRESS', 'FEATURE', 'ROTATE', 'EVALUATE');

-- AlterTable
ALTER TABLE "AIActionLog" ADD COLUMN     "actionType" "AIActionType",
ADD COLUMN     "confidenceScore" DOUBLE PRECISION,
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" "AIEntityType",
ADD COLUMN     "inputHash" TEXT,
ADD COLUMN     "manualOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modelUsed" TEXT,
ADD COLUMN     "outputHash" TEXT;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "aiEvaluatedAt" TIMESTAMP(3),
ADD COLUMN     "aiFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiSuppressed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dealPriorityScore" DOUBLE PRECISION,
ADD COLUMN     "urgencyTier" "UrgencyTier";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "aiConfidenceScore" DOUBLE PRECISION,
ADD COLUMN     "aiDisabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiFinalSummary" TEXT,
ADD COLUMN     "aiLastGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "aiResearchDraft" TEXT;

-- CreateIndex
CREATE INDEX "AIActionLog_entityType_actionType_startedAt_idx" ON "AIActionLog"("entityType", "actionType", "startedAt");
