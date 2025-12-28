import { Response } from 'express';
import { AdminMerchantService } from '../services/adminMerchant.service';
import { AuthRequest } from '../types/auth.types';

const adminMerchantService = new AdminMerchantService();

export class AdminMerchantController {
  async getPendingMerchants(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const merchants = await adminMerchantService.getPendingMerchants();

      res.status(200).json({
        success: true,
        data: merchants
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getMerchantDetails(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const merchantId = req.params.merchantId;

      if (!merchantId) {
        return res.status(400).json({
          success: false,
          message: 'Merchant ID is required'
        });
      }

      const merchant = await adminMerchantService.getMerchantVerificationDetails(merchantId);

      res.status(200).json({
        success: true,
        data: merchant
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  async approveStep(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const merchantId = req.params.merchantId;
      const step = req.params.step;

      if (!merchantId || !step) {
        return res.status(400).json({
          success: false,
          message: 'Merchant ID and step are required'
        });
      }

      if (!['id', 'location', 'product', 'businessLicense', 'registrationNumber'].includes(step)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid step. Must be: id, location, product, businessLicense, or registrationNumber'
        });
      }

      const verification = await adminMerchantService.approveStep(
        merchantId,
        step as any,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        message: `${step} verification approved`,
        data: verification
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async rejectStep(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const merchantId = req.params.merchantId;
      const step = req.params.step;
      const { rejectionReason } = req.body;

      if (!merchantId || !step) {
        return res.status(400).json({
          success: false,
          message: 'Merchant ID and step are required'
        });
      }

      if (!['id', 'location', 'product', 'businessLicense', 'registrationNumber'].includes(step)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid step. Must be: id, location, product, businessLicense, or registrationNumber'
        });
      }

      if (!rejectionReason) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required'
        });
      }

      const verification = await adminMerchantService.rejectStep(
        merchantId,
        step as any,
        req.user.userId,
        rejectionReason
      );

      res.status(200).json({
        success: true,
        message: `${step} verification rejected`,
        data: verification
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async getAllMerchants(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const { status } = req.query;
      const merchants = await adminMerchantService.getAllMerchants(status as any);

      res.status(200).json({
        success: true,
        data: merchants
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}