-- AlterTable
ALTER TABLE "DiscoveryCandidate"
ADD COLUMN     "sourcePublishedAt" TIMESTAMP(3),
ADD COLUMN     "freshnessScore" DOUBLE PRECISION,
ADD COLUMN     "isFresh" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_isFresh_idx" ON "DiscoveryCandidate"("isFresh");

