-- CreateTable
CREATE TABLE "rider_wallet_transactions" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "reference" TEXT NOT NULL,
    "paystackReference" TEXT,
    "bankDetails" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "rider_wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_wallet_transactions" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "reference" TEXT NOT NULL,
    "paystackReference" TEXT,
    "bankDetails" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "platform_wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rider_wallet_transactions_reference_key" ON "rider_wallet_transactions"("reference");

-- CreateIndex
CREATE INDEX "rider_wallet_transactions_riderId_idx" ON "rider_wallet_transactions"("riderId");

-- CreateIndex
CREATE INDEX "rider_wallet_transactions_status_idx" ON "rider_wallet_transactions"("status");

-- CreateIndex
CREATE INDEX "rider_wallet_transactions_createdAt_idx" ON "rider_wallet_transactions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "platform_wallet_transactions_reference_key" ON "platform_wallet_transactions"("reference");

-- CreateIndex
CREATE INDEX "platform_wallet_transactions_adminId_idx" ON "platform_wallet_transactions"("adminId");

-- CreateIndex
CREATE INDEX "platform_wallet_transactions_status_idx" ON "platform_wallet_transactions"("status");

-- CreateIndex
CREATE INDEX "platform_wallet_transactions_createdAt_idx" ON "platform_wallet_transactions"("createdAt");

-- AddForeignKey
ALTER TABLE "rider_wallet_transactions" ADD CONSTRAINT "rider_wallet_transactions_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_wallet_transactions" ADD CONSTRAINT "platform_wallet_transactions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
