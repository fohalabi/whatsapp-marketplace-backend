/*
  Warnings:

  - You are about to drop the column `refundRequestAt` on the `customer_orders` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "customer_orders" DROP COLUMN "refundRequestAt",
ADD COLUMN     "refundRequestedAt" TIMESTAMP(3);
