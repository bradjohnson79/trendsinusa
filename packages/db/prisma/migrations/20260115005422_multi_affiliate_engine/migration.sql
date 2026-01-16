-- CreateEnum
CREATE TYPE "AffiliateProvider" AS ENUM ('AMAZON', 'WALMART', 'TARGET');

-- CreateTable
CREATE TABLE "AffiliateProviderConfig" (
    "id" TEXT NOT NULL,
    "provider" "AffiliateProvider" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "affiliateId" TEXT,
    "linkTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAffiliateLink" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "provider" "AffiliateProvider" NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAffiliateLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProviderConfig_provider_key" ON "AffiliateProviderConfig"("provider");

-- CreateIndex
CREATE INDEX "AffiliateProviderConfig_enabled_priority_idx" ON "AffiliateProviderConfig"("enabled", "priority");

-- CreateIndex
CREATE INDEX "ProductAffiliateLink_provider_enabled_idx" ON "ProductAffiliateLink"("provider", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAffiliateLink_productId_provider_key" ON "ProductAffiliateLink"("productId", "provider");

-- AddForeignKey
ALTER TABLE "ProductAffiliateLink" ADD CONSTRAINT "ProductAffiliateLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
