-- CreateEnum
CREATE TYPE "IngestionProvider" AS ENUM ('AMAZON', 'WALMART', 'TARGET', 'BEST_BUY');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ingestionProvider" "IngestionProvider" NOT NULL DEFAULT 'AMAZON';

-- CreateTable
CREATE TABLE "ProductRawPayload" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "provider" "IngestionProvider" NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadHash" TEXT,

    CONSTRAINT "ProductRawPayload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductRawPayload_provider_fetchedAt_idx" ON "ProductRawPayload"("provider", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRawPayload_productId_provider_key" ON "ProductRawPayload"("productId", "provider");

-- CreateIndex
CREATE INDEX "Product_ingestionProvider_idx" ON "Product"("ingestionProvider");

-- AddForeignKey
ALTER TABLE "ProductRawPayload" ADD CONSTRAINT "ProductRawPayload_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
