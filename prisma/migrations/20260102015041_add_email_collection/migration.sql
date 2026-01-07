-- AlterTable
ALTER TABLE "customer_orders" ADD COLUMN     "emailCollectionStatus" TEXT,
ADD COLUMN     "pendingEmailCollection" BOOLEAN NOT NULL DEFAULT false;
