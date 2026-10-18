-- Co-hosts: people who keep their own guest list for someone else's event.
-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "coHostId" TEXT;

-- CreateTable
CREATE TABLE "CoHost" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "guestLimit" INTEGER,
    "userId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "inviteNonce" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoHost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoHost_userId_idx" ON "CoHost"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CoHost_eventId_email_key" ON "CoHost"("eventId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "CoHost_eventId_userId_key" ON "CoHost"("eventId", "userId");

-- CreateIndex
CREATE INDEX "Guest_coHostId_idx" ON "Guest"("coHostId");

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_coHostId_fkey" FOREIGN KEY ("coHostId") REFERENCES "CoHost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoHost" ADD CONSTRAINT "CoHost_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoHost" ADD CONSTRAINT "CoHost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

