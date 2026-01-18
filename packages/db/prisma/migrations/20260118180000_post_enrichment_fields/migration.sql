-- CreateEnum
CREATE TYPE "LinkStatus" AS ENUM ('ACTIVE', 'DEAD', 'UNKNOWN');

-- AlterTable
ALTER TABLE "DiscoveryCandidate"
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "thumbnailGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "thumbnailSource" TEXT,
ADD COLUMN     "linkStatus" "LinkStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UnaffiliatedPost"
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "thumbnailGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "thumbnailSource" TEXT,
ADD COLUMN     "linkStatus" "LinkStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3);

