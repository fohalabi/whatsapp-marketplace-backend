-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('NOT_SYNCED', 'SYNCED', 'FAILED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "whatsappProductId" TEXT,
ADD COLUMN     "whatsappSyncStatus" "SyncStatus" NOT NULL DEFAULT 'NOT_SYNCED';
