-- The date and/or time of an event can be "to be announced".
ALTER TABLE "Event" ADD COLUMN "dateTbd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "timeTbd" BOOLEAN NOT NULL DEFAULT false;
