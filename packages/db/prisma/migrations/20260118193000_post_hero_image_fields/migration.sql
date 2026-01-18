-- CreateEnum
CREATE TYPE "HeroImageSource" AS ENUM ('ai', 'placeholder');

-- AlterTable
ALTER TABLE "UnaffiliatedPost"
ADD COLUMN     "heroImageUrl" TEXT,
ADD COLUMN     "heroImageGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "heroImageSource" "HeroImageSource" NOT NULL DEFAULT 'placeholder';

