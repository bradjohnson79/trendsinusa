-- DropIndex
DROP INDEX "AffiliateConfig_region_key";

-- DropIndex
DROP INDEX "AffiliateProviderConfig_provider_key";

-- AlterTable
ALTER TABLE "AffiliateConfig" ADD COLUMN     "siteKey" TEXT NOT NULL DEFAULT 'trendsinusa';

-- AlterTable
ALTER TABLE "AffiliateProviderConfig" ADD COLUMN     "siteKey" TEXT NOT NULL DEFAULT 'trendsinusa';

-- CreateIndex
CREATE INDEX "AffiliateConfig_siteKey_enabled_idx" ON "AffiliateConfig"("siteKey", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateConfig_siteKey_region_key" ON "AffiliateConfig"("siteKey", "region");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProviderConfig_siteKey_provider_key" ON "AffiliateProviderConfig"("siteKey", "provider");
