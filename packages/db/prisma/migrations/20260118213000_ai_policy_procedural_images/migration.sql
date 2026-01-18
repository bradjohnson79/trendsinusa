-- Add new enum value for procedural-only hero images.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'HeroImageSource' AND e.enumlabel = 'procedural'
  ) THEN
    ALTER TYPE "HeroImageSource" ADD VALUE 'procedural';
  END IF;
END$$;

-- AlterTable
ALTER TABLE "DiscoveryCandidate"
ADD COLUMN IF NOT EXISTS "thumbnailInputHash" TEXT;

-- AlterTable
ALTER TABLE "UnaffiliatedPost"
ADD COLUMN IF NOT EXISTS "thumbnailInputHash" TEXT,
ADD COLUMN IF NOT EXISTS "heroImageInputHash" TEXT;
