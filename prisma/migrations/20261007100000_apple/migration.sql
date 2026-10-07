-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "walletUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "appleSub" TEXT;

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "WalletRegistration" (
    "id" TEXT NOT NULL,
    "deviceLibraryId" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "passTypeId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletRegistration_serialNumber_idx" ON "WalletRegistration"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRegistration_deviceLibraryId_passTypeId_serialNumber_key" ON "WalletRegistration"("deviceLibraryId", "passTypeId", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_appleSub_key" ON "User"("appleSub");

