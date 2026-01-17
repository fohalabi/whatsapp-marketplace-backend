-- CreateTable
CREATE TABLE "platform_config" (
    "id" TEXT NOT NULL,
    "businessHoursEnabled" BOOLEAN NOT NULL DEFAULT true,
    "openTime" TEXT NOT NULL DEFAULT '09:00',
    "closeTime" TEXT NOT NULL DEFAULT '18:00',
    "mainlandToIsland" DOUBLE PRECISION NOT NULL DEFAULT 2500,
    "islandToMainland" DOUBLE PRECISION NOT NULL DEFAULT 2500,
    "mainlandToMainland" DOUBLE PRECISION NOT NULL DEFAULT 1500,
    "islandToIsland" DOUBLE PRECISION NOT NULL DEFAULT 1500,
    "defaultDeliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 2000,
    "orderCutoffEnabled" BOOLEAN NOT NULL DEFAULT true,
    "orderCutoffTime" TEXT NOT NULL DEFAULT '20:00',
    "autoConfirmOrders" BOOLEAN NOT NULL DEFAULT false,
    "allowWeekendDelivery" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("id")
);
