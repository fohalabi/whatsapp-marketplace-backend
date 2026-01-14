-- AlterTable
ALTER TABLE "customer_orders" ADD COLUMN     "deliveryConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deliveryConfirmedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "autoReleaseAt" TIMESTAMP(3),
ADD COLUMN     "confirmationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "customerConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customerConfirmedAt" TIMESTAMP(3);
