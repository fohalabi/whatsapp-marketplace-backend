import { VerificationStatus } from '@prisma/client';
import prisma from '../config/database';

type VerificationStep = 'id' | 'location' | 'product' | 'businessLicense' | 'registrationNumber';

export class AdminMerchantService {
  async getPendingMerchants() {
    const merchants = await prisma.merchant.findMany({
      where: {
        verificationStatus: VerificationStatus.PENDING
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
            createdAt: true
          }
        },
        verification: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return merchants;
  }

  async getMerchantVerificationDetails(merchantId: string) {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        user: {
          select: {
            email: true,
            name: true,
            createdAt: true
          }
        },
        verification: true
      }
    });

    if (!merchant) {
      throw new Error('Merchant not found');
    }

    return merchant;
  }

  async approveStep(merchantId: string, step: VerificationStep, reviewedBy: string) {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { verification: true }
    });

    if (!merchant || !merchant.verification) {
      throw new Error('Merchant or verification not found');
    }

    const updateData: any = {
      reviewedBy
    };

    if (step === 'id') {
      updateData.idVerificationStatus = VerificationStatus.VERIFIED;
      updateData.idVerifiedAt = new Date();
      updateData.idRejectionReason = null;
    } else if (step === 'location') {
      updateData.locationVerificationStatus = VerificationStatus.VERIFIED;
      updateData.locationVerifiedAt = new Date();
      updateData.locationRejectionReason = null;
    } else if (step === 'product') {
      updateData.productSampleStatus = VerificationStatus.VERIFIED;
      updateData.productSampleVerifiedAt = new Date();
      updateData.productRejectionReason = null;
    } else if (step === 'businessLicense') {
      updateData.businessLicenseStatus = VerificationStatus.VERIFIED;
      updateData.businessLicenseVerifiedAt = new Date();
      updateData.businessLicenseRejectionReason = null;
    } else if (step === 'registrationNumber') {
      updateData.registrationNumberStatus = VerificationStatus.VERIFIED;
      updateData.registrationNumberVerifiedAt = new Date();
      updateData.registrationNumberRejectionReason = null;
    }

    const updatedVerification = await prisma.merchantVerification.update({
      where: { merchantId },
      data: updateData
    });

    // Check if all required steps are approved
    if (
      updatedVerification.idVerificationStatus === VerificationStatus.VERIFIED &&
      updatedVerification.locationVerificationStatus === VerificationStatus.VERIFIED &&
      updatedVerification.productSampleStatus === VerificationStatus.VERIFIED
    ) {
      await prisma.merchant.update({
        where: { id: merchantId },
        data: { verificationStatus: VerificationStatus.VERIFIED }
      });

      await prisma.merchantVerification.update({
        where: { merchantId },
        data: {
          status: VerificationStatus.VERIFIED,
          reviewedAt: new Date()
        }
      });
    }

    return updatedVerification;
  }

  async rejectStep(
    merchantId: string,
    step: VerificationStep,
    reviewedBy: string,
    rejectionReason: string
  ) {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { verification: true }
    });

    if (!merchant || !merchant.verification) {
      throw new Error('Merchant or verification not found');
    }

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new Error('Rejection reason is required');
    }

    const updateData: any = {
      reviewedBy
    };

    if (step === 'id') {
      updateData.idVerificationStatus = VerificationStatus.REJECTED;
      updateData.idRejectionReason = rejectionReason;
    } else if (step === 'location') {
      updateData.locationVerificationStatus = VerificationStatus.REJECTED;
      updateData.locationRejectionReason = rejectionReason;
    } else if (step === 'product') {
      updateData.productSampleStatus = VerificationStatus.REJECTED;
      updateData.productRejectionReason = rejectionReason;
    } else if (step === 'businessLicense') {
      updateData.businessLicenseStatus = VerificationStatus.REJECTED;
      updateData.businessLicenseRejectionReason = rejectionReason;
    } else if (step === 'registrationNumber') {
      updateData.registrationNumberStatus = VerificationStatus.REJECTED;
      updateData.registrationNumberRejectionReason = rejectionReason;
    }

    const updatedVerification = await prisma.merchantVerification.update({
      where: { merchantId },
      data: updateData
    });

    return updatedVerification;
  }

  async getAllMerchants(status?: VerificationStatus) {
    const where = status ? { verificationStatus: status } : {};

    const merchants = await prisma.merchant.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            name: true,
            createdAt: true
          }
        },
        verification: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return merchants;
  }

  async suspendMerchant(merchantId: string) {
    const merchant = await prisma.merchant.update({
      where: { id: merchantId },
      data: { verificationStatus: VerificationStatus.REJECTED }
    });
    return merchant;
  }

  async activateMerchant(merchantId: string) {
    const merchant = await prisma.merchant.update({
      where: { id: merchantId },
      data: { verificationStatus: VerificationStatus.VERIFIED }
    });
    return merchant;
  }
}