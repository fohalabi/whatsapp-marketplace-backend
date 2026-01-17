import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { AdminDashboardService } from '../services/adminDashboard.service';

export class AdminDashboardController {
  private dashboardService: AdminDashboardService;

  constructor() {
    this.dashboardService = new AdminDashboardService();
  }

  async getDashboard(req: AuthRequest, res: Response) {
    try {
      // Verify admin access
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      const timeFrame = (req.query.timeFrame as 'today' | '7days' | '30days') || 'today';
      
      // Fetch all dashboard data in parallel
      const [
        stats,
        revenueTrend,
        categoryPerformance,
        topMerchants,
        deliveryZones,
        orderFlow,
        alerts,
        systemHealth,
        quickStats
      ] = await Promise.all([
        this.dashboardService.getAdminStats(timeFrame),
        this.dashboardService.getRevenueTrend(timeFrame),
        this.dashboardService.getCategoryPerformance(),
        this.dashboardService.getTopMerchants(5),
        this.dashboardService.getDeliveryZonePerformance(),
        this.dashboardService.getOrderFlowStatus(),
        this.dashboardService.getAlerts(),
        this.dashboardService.getSystemHealth(),
        this.dashboardService.getQuickStats()
      ]);

      res.json({
        success: true,
        data: {
          stats,
          revenueTrend,
          categoryPerformance,
          topMerchants,
          deliveryZones,
          orderFlow,
          alerts,
          systemHealth,
          quickStats
        },
        meta: {
          timeFrame,
          generatedAt: new Date().toISOString(),
          userId: req.user!.userId
        }
      });
    } catch (error: any) {
      console.error('Admin dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load admin dashboard',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async getStats(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const timeFrame = (req.query.timeFrame as 'today' | '7days' | '30days') || 'today';
      const stats = await this.dashboardService.getAdminStats(timeFrame);
      
      res.json({ success: true, data: stats });
    } catch (error: any) {
      console.error('Get admin stats error:', error);
      res.status(500).json({ success: false, message: 'Failed to load stats' });
    }
  }

  async getRevenueTrend(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const timeFrame = (req.query.timeFrame as 'today' | '7days' | '30days') || '7days';
      const trend = await this.dashboardService.getRevenueTrend(timeFrame);
      
      res.json({ success: true, data: trend, timeFrame });
    } catch (error: any) {
      console.error('Get revenue trend error:', error);
      res.status(500).json({ success: false, message: 'Failed to load revenue trend' });
    }
  }

  async getTopMerchants(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const limit = parseInt(req.query.limit as string) || 5;
      const merchants = await this.dashboardService.getTopMerchants(limit);
      
      res.json({ success: true, data: merchants });
    } catch (error: any) {
      console.error('Get top merchants error:', error);
      res.status(500).json({ success: false, message: 'Failed to load top merchants' });
    }
  }

  async getDeliveryZones(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const zones = await this.dashboardService.getDeliveryZonePerformance();
      res.json({ success: true, data: zones });
    } catch (error: any) {
      console.error('Get delivery zones error:', error);
      res.status(500).json({ success: false, message: 'Failed to load delivery zones' });
    }
  }

  async getOrderFlow(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const orderFlow = await this.dashboardService.getOrderFlowStatus();
      res.json({ success: true, data: orderFlow });
    } catch (error: any) {
      console.error('Get order flow error:', error);
      res.status(500).json({ success: false, message: 'Failed to load order flow' });
    }
  }

  async getAlerts(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const alerts = await this.dashboardService.getAlerts();
      res.json({ success: true, data: alerts });
    } catch (error: any) {
      console.error('Get alerts error:', error);
      res.status(500).json({ success: false, message: 'Failed to load alerts' });
    }
  }

  async getSystemHealth(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const health = await this.dashboardService.getSystemHealth();
      res.json({ success: true, data: health });
    } catch (error: any) {
      console.error('Get system health error:', error);
      res.status(500).json({ success: false, message: 'Failed to load system health' });
    }
  }

  async exportReport(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const { startDate, endDate, reportType } = req.body;
      
      // Validate input
      if (!startDate || !endDate || !reportType) {
        return res.status(400).json({
          success: false,
          message: 'startDate, endDate, and reportType are required'
        });
      }

      // Validate date format
      if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)'
        });
      }

      // Validate reportType
      const validReportTypes = ['sales', 'merchants', 'delivery', 'orders'];
      if (!validReportTypes.includes(reportType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid reportType. Must be one of: ${validReportTypes.join(', ')}`
        });
      }
      
      // Generate report data
      const reportData = await this.generateReport(startDate, endDate, reportType);
      
      // You can implement CSV/PDF generation here
      res.json({
        success: true,
        message: 'Report generated successfully',
        data: reportData,
        downloadUrl: `/api/admin/reports/download/${Date.now()}.csv` // Example download URL
      });
    } catch (error: any) {
      console.error('Export report error:', error);
      res.status(500).json({ success: false, message: 'Failed to generate report' });
    }
  }

  async healthCheck(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const systemHealth = await this.dashboardService.getSystemHealth();
      const allOperational = systemHealth.every(service => service.status === 'operational');
      
      res.json({
        success: true,
        data: {
          status: allOperational ? 'healthy' : 'degraded',
          services: systemHealth,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('Health check error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'System health check failed',
        status: 'down'
      });
    }
  }

  private async generateReport(startDate: string, endDate: string, reportType: string) {
    // Implement report generation logic based on reportType
    // This could be sales report, merchant report, delivery report, etc.
    return {
      period: { startDate, endDate },
      reportType,
      generatedAt: new Date().toISOString(),
      summary: 'Report data will be implemented based on requirements'
    };
  }
}