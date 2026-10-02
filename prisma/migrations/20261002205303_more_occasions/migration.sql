-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'NEWBORN';
ALTER TYPE "EventType" ADD VALUE 'BABY_SHOWER';
ALTER TYPE "EventType" ADD VALUE 'AQIQAH';
ALTER TYPE "EventType" ADD VALUE 'HENNA';
ALTER TYPE "EventType" ADD VALUE 'ANNIVERSARY';
ALTER TYPE "EventType" ADD VALUE 'RAMADAN';
