-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL,
    "affiliateTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Site_code_key" ON "Site"("code");

-- CreateIndex
CREATE INDEX "Site_enabled_idx" ON "Site"("enabled");

