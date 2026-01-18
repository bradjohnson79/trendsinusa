-- CreateEnum
CREATE TYPE "ImageIntentEntityType" AS ENUM ('DISCOVERY_CANDIDATE', 'RETAIL_PRODUCT');

-- CreateEnum
CREATE TYPE "ImageIntentImageType" AS ENUM ('CARD', 'HERO', 'OG');

-- CreateEnum
CREATE TYPE "ImageIntentStatus" AS ENUM ('PENDING', 'GENERATED', 'FAILED');

-- CreateTable
CREATE TABLE "ImageIntent" (
    "id" TEXT NOT NULL,
    "entityType" "ImageIntentEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "imageType" "ImageIntentImageType" NOT NULL,
    "status" "ImageIntentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImageIntent_status_createdAt_idx" ON "ImageIntent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ImageIntent_entityType_entityId_imageType_idx" ON "ImageIntent"("entityType", "entityId", "imageType");

