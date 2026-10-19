-- Numbers that asked INVTRA to stop sending them WhatsApp messages.
-- CreateTable
CREATE TABLE "WhatsAppOptOut" (
    "phone" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppOptOut_pkey" PRIMARY KEY ("phone")
);

