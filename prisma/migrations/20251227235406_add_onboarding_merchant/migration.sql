/*
  Warnings:

  - You are about to drop the column `theme` on the `user_preferences` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "merchant_verifications" ADD COLUMN     "businessLicenseRejectionReason" TEXT,
ADD COLUMN     "businessLicenseStatus" "VerificationStatus",
ADD COLUMN     "businessLicenseVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "idRejectionReason" TEXT,
ADD COLUMN     "idVerificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "idVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "locationRejectionReason" TEXT,
ADD COLUMN     "locationVerificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "locationVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "productRejectionReason" TEXT,
ADD COLUMN     "productSampleStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "productSampleVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "registrationNumberRejectionReason" TEXT,
ADD COLUMN     "registrationNumberStatus" "VerificationStatus",
ADD COLUMN     "registrationNumberVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_preferences" DROP COLUMN "theme";
