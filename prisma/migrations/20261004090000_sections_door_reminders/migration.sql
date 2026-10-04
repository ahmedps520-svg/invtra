-- CreateEnum
CREATE TYPE "GuestSection" AS ENUM ('MEN', 'WOMEN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MessagePurpose" ADD VALUE 'REMINDER';
ALTER TYPE "MessagePurpose" ADD VALUE 'NUDGE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TemplatePurpose" ADD VALUE 'REMINDER';
ALTER TYPE "TemplatePurpose" ADD VALUE 'NUDGE';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "autoReminder" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "doorToken" TEXT,
ADD COLUMN     "doorTokenCreatedAt" TIMESTAMP(3),
ADD COLUMN     "sectionTeaserMedia" JSONB,
ADD COLUMN     "sections" JSONB,
ADD COLUMN     "sectionsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "nudgeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nudgedAt" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "section" "GuestSection";

-- CreateIndex
CREATE UNIQUE INDEX "Event_doorToken_key" ON "Event"("doorToken");

