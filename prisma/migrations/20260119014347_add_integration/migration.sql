-- CreateEnum
CREATE TYPE "IntegrationCategory" AS ENUM ('COMMUNICATION', 'PAYMENT', 'DELIVERY', 'ANALYTICS');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "IntegrationCategory" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "lastSync" TIMESTAMP(3),
    "encryptedApiKey" TEXT,
    "encryptedApiSecret" TEXT,
    "encryptedWebhookUrl" TEXT,
    "encryptionIv" TEXT,
    "endpoint" TEXT,
    "version" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "connectedAt" TIMESTAMP(3),

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integrations_integrationId_key" ON "integrations"("integrationId");
