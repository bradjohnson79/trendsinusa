-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AIRole" ADD VALUE 'HERO_IMAGE_GENERATOR';
ALTER TYPE "AIRole" ADD VALUE 'CATEGORY_IMAGE_GENERATOR';

-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "imageSet" JSONB,
ADD COLUMN     "key" TEXT;

-- CreateTable
CREATE TABLE "AutomationConfig" (
    "id" TEXT NOT NULL,
    "siteKey" TEXT NOT NULL,
    "imageGenEnabled" BOOLEAN NOT NULL DEFAULT false,
    "heroRegenerateAt" TIMESTAMP(3),
    "categoryRegenerateAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutomationConfig_siteKey_key" ON "AutomationConfig"("siteKey");

-- CreateIndex
CREATE INDEX "AutomationConfig_imageGenEnabled_idx" ON "AutomationConfig"("imageGenEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "Banner_key_key" ON "Banner"("key");
