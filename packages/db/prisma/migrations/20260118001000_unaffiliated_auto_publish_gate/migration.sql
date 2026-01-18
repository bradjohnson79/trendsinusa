-- AlterTable
ALTER TABLE "AutomationGate" ADD COLUMN     "unaffiliatedAutoPublishEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "AutomationGate_unaffiliatedAutoPublishEnabled_idx" ON "AutomationGate"("unaffiliatedAutoPublishEnabled");

