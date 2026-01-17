import { Response } from 'express';
import { MerchantService } from '../services/verification.service';
import { AuthRequest } from '../types/auth.types';
import path from 'path';
import { comparePassword, hashPassword } from '../utils/password.utils';
import prisma from '../config/database';

const merchantService = new MerchantService();

export class MerchantController {
  async submitVerification(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // Validate required files
      if (!files.governmentId?.[0] || !files.productSample?.[0]) {
        return res.status(400).json({
          success: false,
          message: 'Required documents are missing',
        });
      }
      
      const verificationData = {
        businessName: req.body.businessName,
        category: req.body.category,
        location: req.body.location,
        phone: req.body.phone,
        businessAddress: req.body.businessAddress,
        registrationNumber: req.body.registrationNumber || undefined,
        profilePictureUrl: files.profilePicture?.[0]?.path,
        governmentIdUrl: files.governmentId[0].path,
        businessLicenseUrl: files.businessLicense?.[0]?.path || undefined,
        productSampleUrl: files.productSample[0].path,
      };

      const result = await merchantService.submitVerification(
        req.user.userId,
        verificationData
      );

      res.status(201).json({
        success: true,
        message: 'Verification submitted successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getMerchantProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const profile = await merchantService.getMerchantProfile(req.user.userId);

      // returns null if no profile found
      res.status(200).json({
        success: true,
        data: profile || null,
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async changePassword(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required',
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const isValid = await comparePassword(currentPassword, user.password);

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect',
        });
      }

      const newHashedPassword = await hashPassword(newPassword);

      await prisma.user.update({
        where: { id: req.user.userId },
        data: { password: newHashedPassword },
      });

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateMerchantProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { businessName, category, location, phone } = req.body;

      // Validation
      if (!businessName || !category || !location) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required',
        });
      }

      const updatedProfile = await merchantService.updateMerchantProfile(
        req.user.userId,
        { businessName, category, location, phone }
      );

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedProfile,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}