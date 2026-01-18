-- AlterTable
ALTER TABLE "AutomationConfig" ADD COLUMN     "automationEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "AutomationConfig_automationEnabled_idx" ON "AutomationConfig"("automationEnabled");

