import { Response } from 'express';
import { OrderService } from '../services/order.service';
import { AuthRequest } from '../types/auth.types';
import prisma from '../config/database';

const orderService = new OrderService();

export class OrderController {
  async getMerchantOrders(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const merchant = await prisma.merchant.findUnique({
        where: { userId: req.user.userId },
      });

      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: 'Merchant profile not found',
        });
      }

      const orders = await orderService.getMerchantOrders(merchant.id);

      res.status(200).json({
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

  async updateOrderStatus(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { orderId } = req.params;

      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: 'Order ID is required',
        });
      }

      const merchant = await prisma.merchant.findUnique({
        where: { userId: req.user.userId },
      });

      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: 'Merchant profile not found',
        });
      }

      const order = await orderService.updateOrderStatus(orderId as string, merchant.id, req.body);

      res.status(200).json({
        success: true,
        message: 'Order status updated successfully',
        data: order,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}