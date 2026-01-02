/*
  Warnings:

  - A unique constraint covering the columns `[paymentReference]` on the table `customer_orders` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "customer_orders" ADD COLUMN     "customerEmail" TEXT,
ADD COLUMN     "paymentReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "customer_orders_paymentReference_key" ON "customer_orders"("paymentReference");
