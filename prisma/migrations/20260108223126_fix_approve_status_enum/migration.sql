/*
  Warnings:

  - The `approvalStatus` column on the `BroadcastTemplate` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "BroadcastTemplate" DROP COLUMN "approvalStatus",
ADD COLUMN     "approvalStatus" "ApproveStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "BroadcastTemplate_approvalStatus_idx" ON "BroadcastTemplate"("approvalStatus");
