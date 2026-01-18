-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "discoveryCandidateId" TEXT;
ALTER TABLE "Product" ADD COLUMN     "discoveryDiscoveredAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN     "discoveryConfidenceScore" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN     "discoveryCategory" TEXT;

-- AlterTable
ALTER TABLE "DiscoveryCandidate" ADD COLUMN     "upgradedProductId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_discoveryCandidateId_key" ON "Product"("discoveryCandidateId");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_upgradedProductId_idx" ON "DiscoveryCandidate"("upgradedProductId");

