import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { RiderApprovalService } from '../services/riderApproval.service';

const riderApprovalService = new RiderApprovalService();

export class RiderApprovalController {
  async getPendingRiders(req: AuthRequest, res: Response) {
    try {
      const riders = await riderApprovalService.getPendingRiders();

      res.json({
        success: true,
        data: riders,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getAllRiders(req: AuthRequest, res: Response) {
    try {
      const { status } = req.query;

      const riders = await riderApprovalService.getAllRiders(status as string);

      res.json({
        success: true,
        data: riders,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async approveRider(req: AuthRequest, res: Response) {
    try {
      const { riderId } = req.params;

      if (!riderId) {
        return res.status(400).json({
          success: false,
          message: 'Rider ID is required',
        });
      }

      const rider = await riderApprovalService.approveRider(riderId, req.user!.userId);

      res.json({
        success: true,
        data: rider,
        message: 'Rider approved successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async rejectRider(req: AuthRequest, res: Response) {
    try {
      const { riderId } = req.params;
      const { reason } = req.body;

      if (!riderId) {
        return res.status(400).json({
          success: false,
          message: 'Rider ID is required',
        });
      }

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required',
        });
      }

      const rider = await riderApprovalService.rejectRider(riderId, req.user!.userId, reason);

      res.json({
        success: true,
        data: rider,
        message: 'Rider rejected',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}