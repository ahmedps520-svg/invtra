-- Custom events prepared by INVTRA staff, and drafts still being designed.
ALTER TABLE "Event" ADD COLUMN "custom" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "customDraft" BOOLEAN NOT NULL DEFAULT false;

-- Events already offered as a custom package are custom events.
UPDATE "Event" SET "custom" = true
WHERE "id" IN (SELECT "eventId" FROM "Order" WHERE "plan" = 'CUSTOM' AND "payToken" IS NOT NULL AND "eventId" IS NOT NULL);
