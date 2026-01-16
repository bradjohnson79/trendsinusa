-- CreateEnum
CREATE TYPE "PlacementType" AS ENUM ('FEATURED', 'EDITORS_PICK', 'SPOTLIGHT');

-- CreateTable
CREATE TABLE "DealPlacement" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "type" "PlacementType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealPlacement_type_enabled_startsAt_endsAt_idx" ON "DealPlacement"("type", "enabled", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "DealPlacement_endsAt_idx" ON "DealPlacement"("endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "DealPlacement_dealId_type_key" ON "DealPlacement"("dealId", "type");

-- AddForeignKey
ALTER TABLE "DealPlacement" ADD CONSTRAINT "DealPlacement_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
