import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { RefundService } from '../services/refund.service';

const refundService = new RefundService();

export class RefundController {
  async getAllRefunds(req: AuthRequest, res: Response) {
    try {
      const status = req.query.status as string | undefined;
      const refunds = await refundService.getAllRefunds(status);

      res.json({
        success: true,
        data: refunds,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async approveRefund(req: AuthRequest, res: Response) {
    try {
      const { orderId } = req.params;
      const { notes } = req.body;

      if (!orderId) {
        return res.status(400).json({
            success: false,
            message: 'Order ID is required',
        });
      }

      const refund = await refundService.approveRefund(orderId, notes);

      res.json({
        success: true,
        message: 'Refund approved',
        data: refund,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async rejectRefund(req: AuthRequest, res: Response) {
    try {
      const { orderId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required',
        });
      }

      if (!orderId) {
        return res.status(400).json({
            success: false,
            message: 'Order ID is required',
        });
      }


      const refund = await refundService.rejectRefund(orderId, reason);

      res.json({
        success: true,
        message: 'Refund rejected',
        data: refund,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async processRefund(req: AuthRequest, res: Response) {
    try {
      const { orderId } = req.params;

      if (!orderId) {
        return res.status(400).json({
            success: false,
            message: 'Order ID is required',
        });
      }


      const refund = await refundService.processRefund(orderId);

      res.json({
        success: true,
        message: 'Refund processed successfully',
        data: refund,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}