-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiscoveryCandidateApprovalStatus') THEN
    CREATE TYPE "DiscoveryCandidateApprovalStatus" AS ENUM ('PENDING','TEMP_APPROVED','APPROVED','DENIED');
  END IF;
END$$;

-- AlterTable
ALTER TABLE "DiscoveryCandidate"
ADD COLUMN IF NOT EXISTS "approvalStatus" "DiscoveryCandidateApprovalStatus" NOT NULL DEFAULT 'PENDING';
