-- CreateEnum
CREATE TYPE "PostingLifecycleState" AS ENUM ('DISCOVERY', 'INGESTED', 'ENRICHED', 'IMAGED', 'READY', 'PUBLISHED');

-- CreateTable
CREATE TABLE "PostingItem" (
    "id" TEXT NOT NULL,
    "state" "PostingLifecycleState" NOT NULL DEFAULT 'DISCOVERY',

    "discoveryCandidateId" TEXT,
    "productId" TEXT,

    "retailer" "DiscoveryCandidateRetailer" NOT NULL,
    "category" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "discoveredAt" TIMESTAMP(3) NOT NULL,

    "ingestedAt" TIMESTAMP(3),
    "enrichedAt" TIMESTAMP(3),
    "imagedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),

    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "policyEligible" BOOLEAN NOT NULL DEFAULT false,
    "policyReason" TEXT,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostingItem_discoveryCandidateId_key" ON "PostingItem"("discoveryCandidateId");

-- CreateIndex
CREATE UNIQUE INDEX "PostingItem_productId_key" ON "PostingItem"("productId");

-- CreateIndex
CREATE INDEX "PostingItem_state_discoveredAt_idx" ON "PostingItem"("state", "discoveredAt");

-- CreateIndex
CREATE INDEX "PostingItem_retailer_discoveredAt_idx" ON "PostingItem"("retailer", "discoveredAt");

-- CreateIndex
CREATE INDEX "PostingItem_approved_policyEligible_idx" ON "PostingItem"("approved", "policyEligible");

-- AddForeignKey
ALTER TABLE "PostingItem" ADD CONSTRAINT "PostingItem_discoveryCandidateId_fkey" FOREIGN KEY ("discoveryCandidateId") REFERENCES "DiscoveryCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingItem" ADD CONSTRAINT "PostingItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

