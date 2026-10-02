-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "teaserMediaExpiresAt" TIMESTAMP(3),
ADD COLUMN     "teaserMediaId" TEXT,
ADD COLUMN     "teaserMediaVersion" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "eventId" TEXT;

-- CreateIndex
CREATE INDEX "Job_eventId_status_idx" ON "Job"("eventId", "status");
