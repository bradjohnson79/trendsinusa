-- CreateTable
CREATE TABLE "ProviderConfig" (
    "id" TEXT NOT NULL,
    "siteKey" TEXT NOT NULL DEFAULT 'trendsinusa',
    "provider" "IngestionProvider" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConfig_siteKey_provider_key" ON "ProviderConfig"("siteKey", "provider");

-- CreateIndex
CREATE INDEX "ProviderConfig_siteKey_enabled_idx" ON "ProviderConfig"("siteKey", "enabled");

-- CreateIndex
CREATE INDEX "ProviderConfig_provider_enabled_idx" ON "ProviderConfig"("provider", "enabled");

