import { VerificationStatus } from '@prisma/client';
import prisma from '../config/database';
import { VerificationData } from '../types/verification.types';

export class MerchantService {
  async submitVerification(userId: string, data: VerificationData) {
    let merchant = await prisma.merchant.findUnique({
      where: { userId }
    });

    if (!merchant) {
      merchant = await prisma.merchant.create({
        data: {
          userId,
          businessName: data.businessName,
          category: data.category,
          location: data.location,
          phone: data.phone,
          profilePictureUrl: data.profilePictureUrl ?? null,
          verificationStatus: VerificationStatus.PENDING
        }
      });
    } else {
      merchant = await prisma.merchant.update({
        where: { userId },
        data: {
          businessName: data.businessName,
          category: data.category,
          location: data.location,
          phone: data.phone,
          profilePictureUrl: data.profilePictureUrl || merchant.profilePictureUrl,
          verificationStatus: VerificationStatus.PENDING
        }
      });
    }

    const verification = await prisma.merchantVerification.upsert({
      where: { merchantId: merchant.id },
      create: {
        merchantId: merchant.id,
        governmentIdUrl: data.governmentIdUrl,
        businessLicenseUrl: data.businessLicenseUrl ?? null,
        productSampleUrl: data.productSampleUrl,
        businessAddress: data.businessAddress,
        registrationNumber: data.registrationNumber ?? null,
        status: VerificationStatus.PENDING
      },
      update: {
        governmentIdUrl: data.governmentIdUrl,
        businessLicenseUrl: data.businessLicenseUrl ?? null,
        productSampleUrl: data.productSampleUrl,
        businessAddress: data.businessAddress,
        registrationNumber: data.registrationNumber ?? null,
        status: VerificationStatus.PENDING,
        rejectionReason: null
      }
    });

    return { merchant, verification };
  }

  async getMerchantProfile(userId: string) {
    const merchant = await prisma.merchant.findUnique({
      where: { userId },
      include: { 
        verification: true,
        user: {
          select: { email: true }
        }
      }
    });

    return merchant;
  }

  async updateMerchantProfile(
    userId: string, 
    data: { businessName: string; category: string; location: string; phone: string }
  ) {
    const merchant = await prisma.merchant.upsert({
      where: { userId },
      update: {
        businessName: data.businessName,
        category: data.category,
        location: data.location,
        phone: data.phone,
      },
      create: {
        userId,
        businessName: data.businessName,
        category: data.category,
        location: data.location,
        phone: data.phone,
        verificationStatus: VerificationStatus.NOT_SUBMITTED,
      },
      include: {
        user: {
          select: { email: true }
        },
        verification: true
      }
    });

    return merchant;
  }
}