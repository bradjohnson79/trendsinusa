-- CreateEnum
CREATE TYPE "UnaffiliatedPostSource" AS ENUM ('DISCOVERY', 'AI_ENRICHED');

-- CreateEnum
CREATE TYPE "UnaffiliatedPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'EXPIRED');

-- CreateTable
CREATE TABLE "UnaffiliatedPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "retailer" "DiscoveryCandidateRetailer" NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageSetId" TEXT,
    "outboundUrl" TEXT NOT NULL,
    "source" "UnaffiliatedPostSource" NOT NULL,
    "status" "UnaffiliatedPostStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnaffiliatedPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnaffiliatedPost_slug_key" ON "UnaffiliatedPost"("slug");

-- CreateIndex
CREATE INDEX "UnaffiliatedPost_status_publishedAt_idx" ON "UnaffiliatedPost"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "UnaffiliatedPost_retailer_category_idx" ON "UnaffiliatedPost"("retailer", "category");

