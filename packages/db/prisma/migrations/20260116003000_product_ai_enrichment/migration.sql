-- AlterEnum
ALTER TYPE "AIRole" ADD VALUE 'PRODUCT_ENRICHMENT';

-- CreateTable
CREATE TABLE "ProductAIEnrichment" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "researchModel" TEXT NOT NULL,
    "finalModel" TEXT NOT NULL,
    "inputHashResearch" TEXT NOT NULL,
    "inputHashFinal" TEXT NOT NULL,
    "outputHashResearch" TEXT,
    "outputHashFinal" TEXT,
    "researchText" TEXT NOT NULL,
    "researchSources" JSONB,
    "finalSummary" TEXT NOT NULL,
    "finalHighlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "finalSources" JSONB,
    "confidenceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAIEnrichment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductAIEnrichment_productId_createdAt_idx" ON "ProductAIEnrichment"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAIEnrichment_productId_inputHashFinal_key" ON "ProductAIEnrichment"("productId", "inputHashFinal");

-- AddForeignKey
ALTER TABLE "ProductAIEnrichment" ADD CONSTRAINT "ProductAIEnrichment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
