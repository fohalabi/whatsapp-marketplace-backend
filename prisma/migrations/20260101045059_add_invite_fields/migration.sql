/*
  Warnings:

  - A unique constraint covering the columns `[inviteToken]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "inviteToken" TEXT,
ADD COLUMN     "inviteTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_inviteToken_key" ON "users"("inviteToken");
