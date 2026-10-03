-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MessagePurpose" ADD VALUE 'PAYMENT_REQUEST';
ALTER TYPE "MessagePurpose" ADD VALUE 'PAYMENT_RECEIPT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TemplatePurpose" ADD VALUE 'PAYMENT_REQUEST';
ALTER TYPE "TemplatePurpose" ADD VALUE 'PAYMENT_RECEIPT';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "payToken" TEXT,
ADD COLUMN     "receiptNumber" TEXT,
ADD COLUMN     "requestSentAt" TIMESTAMP(3),
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "ReceiptCounter" (
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReceiptCounter_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_payToken_key" ON "Order"("payToken");

-- CreateIndex
CREATE UNIQUE INDEX "Order_receiptNumber_key" ON "Order"("receiptNumber");

