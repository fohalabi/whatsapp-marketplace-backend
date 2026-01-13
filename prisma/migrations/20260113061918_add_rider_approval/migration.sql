-- AlterTable
ALTER TABLE "riders" ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "rejectionReason" TEXT;
