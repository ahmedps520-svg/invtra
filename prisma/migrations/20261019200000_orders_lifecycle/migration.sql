-- CreateEnum
CREATE TYPE "Product" AS ENUM ('INVITATION', 'CUSTOM_DESIGN', 'PHOTO_ONLY');

-- CreateEnum
CREATE TYPE "DesignSource" AS ENUM ('TEMPLATE', 'REQUEST', 'UPLOAD');

-- CreateEnum
CREATE TYPE "OrderStage" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_VERIFICATION', 'INFO_REQUIRED', 'REJECTED', 'APPROVED', 'IN_PRODUCTION', 'READY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderFileKind" AS ENUM ('RECEIPT', 'FINAL');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'IN_APP');

-- CreateEnum
CREATE TYPE "OrderDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterEnum
ALTER TYPE "UploadKind" ADD VALUE 'REFERENCE';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "designBrief" TEXT,
ADD COLUMN     "designSource" "DesignSource" NOT NULL DEFAULT 'TEMPLATE',
ADD COLUMN     "features" JSONB,
ADD COLUMN     "product" "Product" NOT NULL DEFAULT 'INVITATION',
ADD COLUMN     "purchasedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "customerNote" TEXT,
ADD COLUMN     "decidedById" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "designSource" "DesignSource",
ADD COLUMN     "infoRequest" TEXT,
ADD COLUMN     "infoRequestedAt" TIMESTAMP(3),
ADD COLUMN     "lines" JSONB,
ADD COLUMN     "product" "Product",
ADD COLUMN     "readyAt" TIMESTAMP(3),
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "stage" "OrderStage" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "transferReference" TEXT,
ALTER COLUMN "plan" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "whatsappUpdatesAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OrderFile" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "OrderFileKind" NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actorId" TEXT,
    "from" "OrderStage",
    "to" "OrderStage" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDelivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "OrderDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" JSONB,
    "href" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderFile_key_key" ON "OrderFile"("key");

-- CreateIndex
CREATE INDEX "OrderFile_orderId_kind_idx" ON "OrderFile"("orderId", "kind");

-- CreateIndex
CREATE INDEX "OrderHistory_orderId_createdAt_idx" ON "OrderHistory"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDelivery_orderId_channel_key" ON "OrderDelivery"("orderId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_stage_createdAt_idx" ON "Order"("stage", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderFile" ADD CONSTRAINT "OrderFile_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderHistory" ADD CONSTRAINT "OrderHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDelivery" ADD CONSTRAINT "OrderDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: existing uploaded designs, events already paid for, and where existing orders stand.
UPDATE "Event" SET "designSource" = 'UPLOAD' WHERE "imageMode" = 'CUSTOM';
UPDATE "Event" e SET "purchasedAt" = COALESCE(
  (SELECT MIN(o."paidAt") FROM "Order" o WHERE o."eventId" = e."id" AND o."status" = 'PAID'),
  e."createdAt"
) WHERE e."plan" IS NOT NULL;
UPDATE "Order" SET "stage" = 'DELIVERED', "approvedAt" = "paidAt", "deliveredAt" = "paidAt" WHERE "status" IN ('PAID', 'REFUNDED');
UPDATE "Order" SET "stage" = 'PENDING_VERIFICATION', "submittedAt" = "createdAt" WHERE "status" = 'PENDING' AND "provider" = 'manual';
UPDATE "Order" SET "stage" = 'CANCELLED' WHERE "status" IN ('CANCELLED', 'FAILED');

-- WhatsApp: tell customers who opted in that their order is ready.
ALTER TYPE "TemplatePurpose" ADD VALUE 'ORDER_UPDATE';
ALTER TYPE "MessagePurpose" ADD VALUE 'ORDER_UPDATE';
