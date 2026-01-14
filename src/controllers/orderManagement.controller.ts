import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { OrderManagementService } from '../services/orderManagement.service';

const orderService = new OrderManagementService();

export class OrderManagementController {
  // Admin: Get all orders
  async getAllOrders(req: AuthRequest, res: Response) {
    try {
      const filters = {
        status: req.query.status as string,
        paymentStatus: req.query.paymentStatus as string,
        search: req.query.search as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20
      };

      const result = await orderService.getAllOrders(filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Merchant: Get merchant orders
  async getMerchantOrders(req: AuthRequest, res: Response) {
    try {
      const merchantId = req.user!.userId;

      if (!merchantId) {
        return res.status(403).json({
          success: false,
          message: 'Merchant ID not found'
        });
      }

      const filters = {
        status: req.query.status as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20
      };

      const result = await orderService.getMerchantOrders(merchantId, filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get order by ID
  async getOrderById(req: AuthRequest, res: Response) {
    try {
      const { orderId } = req.params;

      if (!orderId) {
        return res.status(400).json({
            success: false,
            message: 'Order ID is required'
        });
      }

      const order = await orderService.getOrderById(orderId);

      res.json({
        success: true,
        data: order
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  // Admin: Update order status
  async updateOrderStatus(req: AuthRequest, res: Response) {
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      if (!orderId) {
        return res.status(400).json({
            success: false,
            message: 'Order ID is required'
        });
      }

      const order = await orderService.updateOrderStatus(
        orderId,
        status,
        req.user!.userId
      );

      res.json({
        success: true,
        message: 'Order status updated',
        data: order
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Merchant: Update order status
  async updateMerchantOrderStatus(req: AuthRequest, res: Response) {
    try {
      const { orderId } = req.params;
      const { status } = req.body;
      const merchantId = req.user!.merchantId;

      if (!merchantId) {
        return res.status(403).json({
          success: false,
          message: 'Merchant ID not found'
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      if (!orderId) {
        return res.status(400).json({
            success: false,
            message: 'Order ID is required'
        });
      }

      const order = await orderService.updateMerchantOrderStatus(
        orderId,
        merchantId,
        status
      );

      res.json({
        success: true,
        message: 'Order status updated',
        data: order
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Admin: Assign courier
  async assignCourier(req: AuthRequest, res: Response) {
    try {
      const { orderId } = req.params;
      const { courierName } = req.body;

      if (!courierName) {
        return res.status(400).json({
          success: false,
          message: 'Courier name is required'
        });
      }

      if (!orderId) {
        return res.status(400).json({
            success: false,
            message: 'Order ID is required'
        });
      }

      const order = await orderService.assignCourier(
        orderId,
        courierName,
        req.user!.userId
      );

      res.json({
        success: true,
        message: 'Courier assigned',
        data: order
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Cancel order
  async cancelOrder(req: AuthRequest, res: Response) {
    try {
      const { orderId } = req.params;

      if (!orderId) {
        return res.status(400).json({
            success: false,
            message: 'Order ID is required'
        });
      }

      const order = await orderService.cancelOrder(orderId, req.user!.userId);

      res.json({
        success: true,
        message: 'Order cancelled',
        data: order
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get order stats
  async getOrderStats(req: AuthRequest, res: Response) {
    try {
      const stats = await orderService.getOrderStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}