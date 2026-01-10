-- AlterTable
ALTER TABLE "customer_orders" ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "deliveryLatitude" DOUBLE PRECISION,
ADD COLUMN     "deliveryLongitude" DOUBLE PRECISION;
