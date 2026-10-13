-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailReminders" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "payReminders" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "payRemindedAt" TIMESTAMP(3);

-- Older drafts don't get reminded all at once on the day this ships; drafts from the last week do.
UPDATE "Event" SET "payReminders" = 2 WHERE "plan" IS NULL AND "createdAt" < NOW() - INTERVAL '7 days';
