-- CreateEnum
CREATE TYPE "DiscoveryCandidateRetailer" AS ENUM ('AMAZON', 'WALMART', 'TARGET', 'BEST_BUY');

-- CreateEnum
CREATE TYPE "DiscoveryCandidateSource" AS ENUM ('PERPLEXITY', 'OPENAI', 'MIXED');

-- CreateEnum
CREATE TYPE "DiscoveryCandidateStatus" AS ENUM ('ACTIVE', 'STALE', 'REMOVED');

-- CreateTable
CREATE TABLE "DiscoveryCandidate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "retailer" "DiscoveryCandidateRetailer" NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "imageQuery" TEXT,
    "outboundUrl" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "source" "DiscoveryCandidateSource" NOT NULL,
    "status" "DiscoveryCandidateStatus" NOT NULL DEFAULT 'ACTIVE',
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "DiscoveryCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_status_discoveredAt_idx" ON "DiscoveryCandidate"("status", "discoveredAt");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_retailer_discoveredAt_idx" ON "DiscoveryCandidate"("retailer", "discoveredAt");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_expiresAt_idx" ON "DiscoveryCandidate"("expiresAt");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_confidenceScore_idx" ON "DiscoveryCandidate"("confidenceScore");

