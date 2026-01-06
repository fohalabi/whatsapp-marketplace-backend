import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { RiderService } from '../services/rider.service';

const riderService = new RiderService();

export class RiderController {
  async getProfile(req: AuthRequest, res: Response) {
    try {
      const profile = await riderService.getRiderProfile(req.user!.userId);

      res.json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateStatus(req: AuthRequest, res: Response) {
    try {
      const { status } = req.body;

      if (!['OFFLINE', 'AVAILABLE', 'BUSY'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status',
        });
      }

      const rider = await riderService.updateRiderStatus(req.user!.userId, status);

      res.json({
        success: true,
        data: rider,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateLocation(req: AuthRequest, res: Response) {
    try {
      const { latitude, longitude } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude required',
        });
      }

      await riderService.updateLocation(req.user!.userId, latitude, longitude);

      res.json({
        success: true,
        message: 'Location updated',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getMyDeliveries(req: AuthRequest, res: Response) {
    try {
      const deliveries = await riderService.getMyDeliveries(req.user!.userId);

      res.json({
        success: true,
        data: deliveries,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateDeliveryStatus(req: AuthRequest, res: Response) {
    try {
        const { deliveryId } = req.params;
        const { status, proofImage, notes } = req.body;

        if (!deliveryId) {
        return res.status(400).json({
            success: false,
            message: 'Delivery ID is required',
        });
        }

        if (!['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'].includes(status)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid status',
        });
        }

        const delivery = await riderService.updateDeliveryStatus(
        req.user!.userId,
        deliveryId,
        status,
        proofImage,
        notes
        );

        res.json({
        success: true,
        data: delivery,
        });
    } catch (error: any) {
        res.status(400).json({
        success: false,
        message: error.message,
        });
    }
  }
}