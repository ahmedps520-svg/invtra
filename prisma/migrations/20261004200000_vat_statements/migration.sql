-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TaxStatement" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rate" INTEGER NOT NULL,
    "receipts" INTEGER NOT NULL,
    "gross" INTEGER NOT NULL,
    "refunds" INTEGER NOT NULL,
    "vat" INTEGER NOT NULL,
    "net" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailedAt" TIMESTAMP(3),

    CONSTRAINT "TaxStatement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxStatement_month_currency_key" ON "TaxStatement"("month", "currency");

