-- CreateTable
CREATE TABLE "AnalyticsConfig" (
    "id" TEXT NOT NULL,
    "siteKey" TEXT NOT NULL,
    "gaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "gaMeasurementId" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsConfig_siteKey_key" ON "AnalyticsConfig"("siteKey");

-- CreateIndex
CREATE INDEX "AnalyticsConfig_gaEnabled_idx" ON "AnalyticsConfig"("gaEnabled");

-- CreateIndex
CREATE INDEX "AnalyticsConfig_lastEventAt_idx" ON "AnalyticsConfig"("lastEventAt");
