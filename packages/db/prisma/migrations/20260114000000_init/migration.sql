-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('ACTIVE', 'EXPIRING_24H', 'EXPIRING_6H', 'EXPIRING_1H', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AffiliateRegion" AS ENUM ('US');

-- CreateEnum
CREATE TYPE "AIRole" AS ENUM ('HERO_HEADLINE_WRITER', 'DEAL_MICRO_COPY_WRITER', 'BANNER_TEXT_WRITER', 'SEO_META_GENERATOR');

-- CreateEnum
CREATE TYPE "AIActionStatus" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "IngestionSource" AS ENUM ('AMAZON_BEST_SELLER', 'AMAZON_LIGHTNING', 'AMAZON_DEAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('STARTED', 'SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('DEAL_INGESTION_STALLED', 'AMAZON_DATA_ANOMALY', 'AI_COPY_FAILURE', 'AFFILIATE_ID_MISSING', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ClickKind" AS ENUM ('AFFILIATE_OUTBOUND');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "source" "IngestionSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT,
    "category" TEXT,
    "productUrl" TEXT,
    "categoryOverride" TEXT,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "source" "IngestionSource" NOT NULL,
    "externalKey" TEXT NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'ACTIVE',
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "discountPercent" INTEGER,
    "currentPriceCents" INTEGER NOT NULL,
    "oldPriceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastEvaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateConfig" (
    "id" TEXT NOT NULL,
    "region" "AffiliateRegion" NOT NULL DEFAULT 'US',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "associateTag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "text" TEXT,
    "imageUrl" TEXT,
    "category" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeroRotation" (
    "id" TEXT NOT NULL,
    "forDate" TIMESTAMP(3) NOT NULL,
    "headline" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'AI',
    "promptVersion" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeroRotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIActionLog" (
    "id" TEXT NOT NULL,
    "role" "AIRole" NOT NULL,
    "status" "AIActionStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "outputPreview" TEXT,
    "promptVersion" TEXT,
    "model" TEXT,
    "error" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AIActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "source" "IngestionSource" NOT NULL,
    "status" "IngestionStatus" NOT NULL DEFAULT 'STARTED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "productsProcessed" INTEGER NOT NULL DEFAULT 0,
    "dealsProcessed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "metadata" JSONB,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAlert" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "noisy" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickEvent" (
    "id" TEXT NOT NULL,
    "kind" "ClickKind" NOT NULL DEFAULT 'AFFILIATE_OUTBOUND',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "href" TEXT NOT NULL,
    "asin" TEXT,
    "dealId" TEXT,
    "productId" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,

    CONSTRAINT "ClickEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_source_idx" ON "Product"("source");

-- CreateIndex
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_source_externalId_key" ON "Product"("source", "externalId");

-- CreateIndex
CREATE INDEX "Deal_status_expiresAt_idx" ON "Deal"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Deal_suppressed_expiresAt_idx" ON "Deal"("suppressed", "expiresAt");

-- CreateIndex
CREATE INDEX "Deal_productId_idx" ON "Deal"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_source_externalKey_key" ON "Deal"("source", "externalKey");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateConfig_region_key" ON "AffiliateConfig"("region");

-- CreateIndex
CREATE INDEX "Banner_enabled_idx" ON "Banner"("enabled");

-- CreateIndex
CREATE INDEX "Banner_category_idx" ON "Banner"("category");

-- CreateIndex
CREATE UNIQUE INDEX "HeroRotation_forDate_key" ON "HeroRotation"("forDate");

-- CreateIndex
CREATE INDEX "AIActionLog_role_startedAt_idx" ON "AIActionLog"("role", "startedAt");

-- CreateIndex
CREATE INDEX "AIActionLog_status_startedAt_idx" ON "AIActionLog"("status", "startedAt");

-- CreateIndex
CREATE INDEX "IngestionRun_source_startedAt_idx" ON "IngestionRun"("source", "startedAt");

-- CreateIndex
CREATE INDEX "IngestionRun_status_startedAt_idx" ON "IngestionRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "SystemAlert_noisy_createdAt_idx" ON "SystemAlert"("noisy", "createdAt");

-- CreateIndex
CREATE INDEX "SystemAlert_resolvedAt_idx" ON "SystemAlert"("resolvedAt");

-- CreateIndex
CREATE INDEX "ClickEvent_kind_occurredAt_idx" ON "ClickEvent"("kind", "occurredAt");

-- CreateIndex
CREATE INDEX "ClickEvent_dealId_idx" ON "ClickEvent"("dealId");

-- CreateIndex
CREATE INDEX "ClickEvent_productId_idx" ON "ClickEvent"("productId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

