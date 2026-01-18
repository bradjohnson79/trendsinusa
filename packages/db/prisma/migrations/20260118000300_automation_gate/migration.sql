-- CreateTable
CREATE TABLE "AutomationGate" (
    "id" TEXT NOT NULL,
    "siteKey" TEXT NOT NULL,
    "ingestionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoPublishEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationGate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutomationGate_siteKey_key" ON "AutomationGate"("siteKey");

-- CreateIndex
CREATE INDEX "AutomationGate_ingestionEnabled_idx" ON "AutomationGate"("ingestionEnabled");

-- CreateIndex
CREATE INDEX "AutomationGate_autoPublishEnabled_idx" ON "AutomationGate"("autoPublishEnabled");

