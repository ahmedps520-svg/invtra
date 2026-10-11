-- CreateEnum
CREATE TYPE "DoorScanResult" AS ENUM ('VALID', 'ALREADY_IN', 'NOT_ACCEPTED', 'UNKNOWN', 'OTHER_EVENT', 'REVOKED');

-- CreateTable
CREATE TABLE "DoorScan" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT,
    "result" "DoorScanResult" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoorScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoorScan_eventId_createdAt_idx" ON "DoorScan"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "DoorScan_guestId_idx" ON "DoorScan"("guestId");

-- AddForeignKey
ALTER TABLE "DoorScan" ADD CONSTRAINT "DoorScan_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoorScan" ADD CONSTRAINT "DoorScan_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
