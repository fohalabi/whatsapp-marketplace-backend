import { Response } from 'express';
import { AdminProfileService } from '../services/adminProfile.service';
import { AuthRequest } from '../types/auth.types';

const adminProfileService = new AdminProfileService();

export class AdminProfileController {
  async getProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const profile = await adminProfileService.getProfile(req.user.userId);

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updatePreferences(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const preferences = await adminProfileService.updatePreferences(
        req.user.userId,
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Preferences updated successfully',
        data: preferences,
      });
    } catch (error: any) {
      res.status(400).json({
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

      const result = await adminProfileService.changePassword(
        req.user.userId,
        req.body
      );

      // Log activity
      await adminProfileService.logActivity(
        req.user.userId,
        'Password changed',
        'User changed their password'
      );

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async toggle2FA(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const result = await adminProfileService.toggle2FA(
        req.user.userId,
        req.body.enabled
      );

      // Log activity
      await adminProfileService.logActivity(
        req.user.userId,
        req.body.enabled ? '2FA enabled' : '2FA disabled',
        `User ${req.body.enabled ? 'enabled' : 'disabled'} two-factor authentication`
      );

      res.status(200).json({
        success: true,
        message: `2FA ${req.body.enabled ? 'enabled' : 'disabled'} successfully`,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}