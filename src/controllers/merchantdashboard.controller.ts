import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { DashboardService } from '../services/merchantdashboard.service';
import prisma from '../config/database';

const dashboardService = new DashboardService();

export class DashboardController {
  async getMerchantStats(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      //Safe Prisma query
      const merchant = await prisma.merchant.findUnique({
        where: { userId: req.user.userId },
        include: {
          verification: true
        }
      });

      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: 'Merchant not found'
        });
      }

      const stats = await dashboardService.getMerchantStats(merchant.id);

      return res.status(200).json({
        success: true,
        data: {
          verification: {
            status: merchant.verificationStatus,
            rejectionReason: merchant.verification?.rejectionReason ?? null
          },
          summary: {
            ordersToPrepare: stats.ordersToPrepare,
            productsListed: stats.productsListed,
            lowStockCount: stats.lowStockCount
          },
          recentOrders: stats.recentOrders,
          lowStockItems: stats.lowStockItems
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
