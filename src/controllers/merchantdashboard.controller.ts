import { Request, Response } from 'express';
import { DashboardService } from '../services/merchantdashboard.service';
import prisma from '../config/database';

export class DashboardController {
  private dashboardService: DashboardService;

  constructor() {
    this.dashboardService = new DashboardService();
  }

  async getMerchantStats(req: Request, res: Response) {
    try {
      console.log(req.user);
      const merchantId = req.user?.id;
      if (!merchantId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized: Merchant ID not found' 
        });
      }

      const stats = await this.dashboardService.getMerchantStats(merchantId);
      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      console.error('Error getting merchant stats:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch merchant statistics',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async getSalesTrend(req: Request, res: Response) {
    try {
      const merchantId = req.user?.userId;
      if (!merchantId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized: Merchant ID not found' 
        });
      }

      const timeFrame = (req.query.timeFrame as 'today' | '7days' | '30days') || '7days';
      
      // Validate timeFrame
      if (!['today', '7days', '30days'].includes(timeFrame)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid timeFrame. Must be one of: today, 7days, 30days'
        });
      }

      const salesTrend = await this.dashboardService.getSalesTrend(merchantId, timeFrame);
      res.json({
        success: true,
        data: salesTrend,
        timeFrame
      });
    } catch (error: any) {
      console.error('Error getting sales trend:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch sales trend data',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async getCategoryPerformance(req: Request, res: Response) {
    try {
      const merchantId = req.user?.userId;
      if (!merchantId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized: Merchant ID not found' 
        });
      }

      const categoryPerformance = await this.dashboardService.getCategoryPerformance(merchantId);
      res.json({
        success: true,
        data: categoryPerformance
      });
    } catch (error: any) {
      console.error('Error getting category performance:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch category performance data',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async getTopProducts(req: Request, res: Response) {
    try {
      const merchantId = req.user?.userId;
      if (!merchantId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized: Merchant ID not found' 
        });
      }

      const limit = parseInt(req.query.limit as string) || 5;
      if (isNaN(limit) || limit < 1 || limit > 50) {
        return res.status(400).json({
          success: false,
          message: 'Invalid limit parameter. Must be between 1 and 50'
        });
      }

      const topProducts = await this.dashboardService.getTopProducts(merchantId, limit);
      res.json({
        success: true,
        data: topProducts,
        limit
      });
    } catch (error: any) {
      console.error('Error getting top products:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch top products data',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async getHourlyPattern(req: Request, res: Response) {
    try {
      const merchantId = req.user?.userId;
      if (!merchantId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized: Merchant ID not found' 
        });
      }

      const hourlyPattern = await this.dashboardService.getHourlyPattern(merchantId);
      res.json({
        success: true,
        data: hourlyPattern
      });
    } catch (error: any) {
      console.error('Error getting hourly pattern:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch hourly pattern data',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async getCustomerMetrics(req: Request, res: Response) {
    try {
      const merchantId = req.user?.userId;
      if (!merchantId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized: Merchant ID not found' 
        });
      }

      const customerMetrics = await this.dashboardService.getCustomerMetrics(merchantId);
      res.json({
        success: true,
        data: customerMetrics
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

  async getDeliveryZonePerformance(req: Request, res: Response) {
    try {
      const merchantId = req.user?.userId;
      if (!merchantId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized: Merchant ID not found' 
        });
      }

      const deliveryZonePerformance = await this.dashboardService.getDeliveryZonePerformance(merchantId);
      res.json({
        success: true,
        data: deliveryZonePerformance
      });
    } catch (error: any) {
      console.error('Error getting delivery zone performance:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch delivery zone performance',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async getDashboardAll(req: Request, res: Response) {
    try {
      const merchantId = req.user?.userId;
      if (!merchantId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized: Merchant ID not found' 
        });
      }

      const timeFrame = (req.query.timeFrame as 'today' | '7days' | '30days') || '7days';
      const limit = parseInt(req.query.limit as string) || 5;

      // Validate parameters
      if (!['today', '7days', '30days'].includes(timeFrame)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid timeFrame. Must be one of: today, 7days, 30days'
        });
      }

      if (isNaN(limit) || limit < 1 || limit > 50) {
        return res.status(400).json({
          success: false,
          message: 'Invalid limit parameter. Must be between 1 and 50'
        });
      }

      // Execute all dashboard queries in parallel for better performance
      const [
        stats,
        salesTrend,
        categoryPerformance,
        topProducts,
        hourlyPattern,
        customerMetrics,
        deliveryZonePerformance
      ] = await Promise.all([
        this.dashboardService.getMerchantStats(merchantId),
        this.dashboardService.getSalesTrend(merchantId, timeFrame),
        this.dashboardService.getCategoryPerformance(merchantId),
        this.dashboardService.getTopProducts(merchantId, limit),
        this.dashboardService.getHourlyPattern(merchantId),
        this.dashboardService.getCustomerMetrics(merchantId),
        this.dashboardService.getDeliveryZonePerformance(merchantId)
      ]);

      res.json({
        success: true,
        data: {
          stats,
          salesTrend,
          categoryPerformance,
          topProducts,
          hourlyPattern,
          customerMetrics,
          deliveryZonePerformance
        },
        meta: {
          timeFrame,
          limit,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('Error getting dashboard data:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch dashboard data',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async healthCheck(req: Request, res: Response) {
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
        where: { id: merchantId },
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