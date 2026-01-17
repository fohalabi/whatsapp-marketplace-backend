import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { DashboardService } from '../services/merchantdashboard.service';
import prisma from '../config/database';

export class DashboardController {
  private dashboardService: DashboardService;

  constructor() {
    this.dashboardService = new DashboardService();
  }

  async getMerchantDashboard(req: AuthRequest, res: Response) {
    try {
      const merchant = await prisma.merchant.findUnique({
        where: { userId: req.user!.userId}
      });

      const merchantId = merchant?.id;

      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Merchant ID not found'
        });
      }

      const timeFrame = (req.query.timeFrame as 'today' | '7days' | '30days') || 'today';

      // Validate timeFrame
      if (!['today', '7days', '30days'].includes(timeFrame)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid timeFrame. Must be one of: today, 7days, 30days'
        });
      }

      const dashboard = await this.dashboardService.getMerchantDashboard(merchantId, timeFrame);

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error: any) {
      console.error('Error getting merchant dashboard:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch merchant dashboard',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async getStats(req: AuthRequest, res: Response) {
    try {
      const merchant = await prisma.merchant.findUnique({
        where: { userId: req.user!.userId}
      });

      const merchantId = merchant?.id;

      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Merchant ID not found'
        });
      }

      const timeFrame = (req.query.timeFrame as 'today' | '7days' | '30days') || 'today';

      const dashboard = await this.dashboardService.getMerchantDashboard(merchantId, timeFrame);

      res.json({
        success: true,
        data: dashboard.stats
      });
    } catch (error: any) {
      console.error('Error getting stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch stats',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async getSalesTrend(req: AuthRequest, res: Response) {
    try {
      const merchant = await prisma.merchant.findUnique({
        where: { userId: req.user!.userId}
      });

      const merchantId = merchant?.id;
      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Merchant ID not found'
        });
      }

      const timeFrame = (req.query.timeFrame as 'today' | '7days' | '30days') || 'today';

      // Validate timeFrame
      if (!['today', '7days', '30days'].includes(timeFrame)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid timeFrame. Must be one of: today, 7days, 30days'
        });
      }

      const dashboard = await this.dashboardService.getMerchantDashboard(merchantId, timeFrame);

      res.json({
        success: true,
        data: dashboard.salesTrend,
        timeFrame
      });
    } catch (error: any) {
      console.error('Error getting sales trend:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch sales trend',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async getCategoryPerformance(req: AuthRequest, res: Response) {
    try {
      const merchant = await prisma.merchant.findUnique({
        where: { userId: req.user!.userId}
      });

      const merchantId = merchant?.id;
      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Merchant ID not found'
        });
      }

      const dashboard = await this.dashboardService.getMerchantDashboard(merchantId, 'today');

      res.json({
        success: true,
        data: dashboard.categoryPerformance
      });
    } catch (error: any) {
      console.error('Error getting category performance:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch category performance',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async getTopProducts(req: AuthRequest, res: Response) {
    try {
      const merchant = await prisma.merchant.findUnique({
        where: { userId: req.user!.userId}
      });

      const merchantId = merchant?.id;
      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Merchant ID not found'
        });
      }

      const timeFrame = (req.query.timeFrame as 'today' | '7days' | '30days') || 'today';

      const dashboard = await this.dashboardService.getMerchantDashboard(merchantId, timeFrame);

      res.json({
        success: true,
        data: dashboard.topProducts
      });
    } catch (error: any) {
      console.error('Error getting top products:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch top products',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async getLowStockProducts(req: AuthRequest, res: Response) {
    try {
      const merchant = await prisma.merchant.findUnique({
        where: { userId: req.user!.userId}
      });

      const merchantId = merchant?.id;
      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Merchant ID not found'
        });
      }

      const dashboard = await this.dashboardService.getMerchantDashboard(merchantId, 'today');

      res.json({
        success: true,
        data: dashboard.lowStockProducts
      });
    } catch (error: any) {
      console.error('Error getting low stock products:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch low stock products',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async getDeliveryZonePerformance(req: AuthRequest, res: Response) {
    try {
      const merchant = await prisma.merchant.findUnique({
        where: { userId: req.user!.userId}
      });

      const merchantId = merchant?.id;
      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Merchant ID not found'
        });
      }

      const timeFrame = (req.query.timeFrame as 'today' | '7days' | '30days') || 'today';

      const dashboard = await this.dashboardService.getMerchantDashboard(merchantId, timeFrame);

      res.json({
        success: true,
        data: dashboard.deliveryZones
      });
    } catch (error: any) {
      console.error('Error getting delivery zones:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch delivery zones',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async getCustomerMetrics(req: AuthRequest, res: Response) {
    try {
      const merchant = await prisma.merchant.findUnique({
        where: { userId: req.user!.userId}
      });

      const merchantId = merchant?.id;
      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Merchant ID not found'
        });
      }

      const timeFrame = (req.query.timeFrame as 'today' | '7days' | '30days') || 'today';

      const dashboard = await this.dashboardService.getMerchantDashboard(merchantId, timeFrame);

      res.json({
        success: true,
        data: dashboard.customerMetrics
      });
    } catch (error: any) {
      console.error('Error getting customer metrics:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch customer metrics',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async healthCheck(req: AuthRequest, res: Response) {
    try {
      const merchantId = req.user?.userId;
      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Merchant ID not found'
        });
      }

      // Quick check if merchant exists
      const merchant = await prisma.merchant.findUnique({
        where: { userId: merchantId },
        select: { id: true, businessName: true }
      });

      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: 'Merchant not found'
        });
      }

      res.json({
        success: true,
        message: 'Dashboard service is healthy',
        merchant: {
          id: merchant.id,
          businessName: merchant.businessName
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Dashboard health check error:', error);
      res.status(500).json({
        success: false,
        message: 'Dashboard service health check failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}