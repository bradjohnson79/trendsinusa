-- CreateTable
CREATE TABLE "AutomationSchedule" (
    "id" TEXT NOT NULL,
    "siteKey" TEXT NOT NULL DEFAULT 'trendsinusa',
    "jobType" "SystemCommandType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "cron" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "lastScheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationSchedule_siteKey_enabled_idx" ON "AutomationSchedule"("siteKey", "enabled");

-- CreateIndex
CREATE INDEX "AutomationSchedule_jobType_enabled_idx" ON "AutomationSchedule"("jobType", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationSchedule_siteKey_jobType_key" ON "AutomationSchedule"("siteKey", "jobType");

