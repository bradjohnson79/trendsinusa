-- CreateTable
CREATE TABLE "ProductPricePoint" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "provider" "IngestionProvider" NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isPromotion" BOOLEAN NOT NULL DEFAULT false,
    "promotionEndsAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPricePoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPricePoint_productId_capturedAt_idx" ON "ProductPricePoint"("productId", "capturedAt");

-- CreateIndex
CREATE INDEX "ProductPricePoint_provider_capturedAt_idx" ON "ProductPricePoint"("provider", "capturedAt");

-- CreateIndex
CREATE INDEX "ProductPricePoint_provider_currency_capturedAt_idx" ON "ProductPricePoint"("provider", "currency", "capturedAt");

-- AddForeignKey
ALTER TABLE "ProductPricePoint" ADD CONSTRAINT "ProductPricePoint_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
