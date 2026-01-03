import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { AbandonedOrderService } from '../services/abandonedOrder.service';

const abandonedOrderService = new AbandonedOrderService();

export class AbandonedOrderController {
  async getAbandonedOrders(req: AuthRequest, res: Response) {
    try {
      const orders = await abandonedOrderService.getAbandonedOrders();

      res.json({
        success: true,
        data: orders,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async resendPaymentLink(req: AuthRequest, res: Response) {
    try {
      const { orderId } = req.params;

       if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required',
            });
        }

      const order = await abandonedOrderService.resendPaymentLink(orderId);

      res.json({
        success: true,
        message: 'Payment link resent',
        data: order,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async cancelOrder(req: AuthRequest, res: Response) {
    try {
      const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required',
            });
        }

      const order = await abandonedOrderService.cancelOrder(orderId);

      res.json({
        success: true,
        message: 'Order cancelled',
        data: order,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async extendTimeout(req: AuthRequest, res: Response) {
    try {
      const { orderId } = req.params;
      const { minutes } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required',
            });
        }

      const order = await abandonedOrderService.extendTimeout(
        orderId,
        minutes || 30
      );

      res.json({
        success: true,
        message: `Timeout extended by ${minutes || 30} minutes`,
        data: order,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await abandonedOrderService.getStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}