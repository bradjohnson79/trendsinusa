-- AlterTable
ALTER TABLE "UnaffiliatedPost" ADD COLUMN     "discoveryCandidateId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UnaffiliatedPost_discoveryCandidateId_key" ON "UnaffiliatedPost"("discoveryCandidateId");

-- AddForeignKey
ALTER TABLE "UnaffiliatedPost" ADD CONSTRAINT "UnaffiliatedPost_discoveryCandidateId_fkey" FOREIGN KEY ("discoveryCandidateId") REFERENCES "DiscoveryCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

