-- DropIndex
DROP INDEX "Product_source_externalId_key";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "asin" TEXT NOT NULL,
ALTER COLUMN "externalId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Product_asin_key" ON "Product"("asin");

