-- AlterTable
ALTER TABLE "escrow" ADD COLUMN     "deliveryFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "productAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "platform_wallet" ADD COLUMN     "deliveryFeeEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "riders" ADD COLUMN     "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "delivery_fee_transactions" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "totalFee" DOUBLE PRECISION NOT NULL,
    "riderAmount" DOUBLE PRECISION NOT NULL,
    "platformAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "delivery_fee_transactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "delivery_fee_transactions" ADD CONSTRAINT "delivery_fee_transactions_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_fee_transactions" ADD CONSTRAINT "delivery_fee_transactions_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
