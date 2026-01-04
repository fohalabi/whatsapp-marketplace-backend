import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { ReportService } from '../services/report.service';

const reportService = new ReportService();

export class ReportController {
  async getFinancialSummary(req: AuthRequest, res: Response) {
    try {
      const { period } = req.query;

      if (!period || !['daily', 'weekly', 'monthly'].includes(period as string)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid period. Use: daily, weekly, or monthly',
        });
      }

      const summary = await reportService.getFinancialSummary(
        period as 'daily' | 'weekly' | 'monthly'
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getMerchantPerformance(req: AuthRequest, res: Response) {
    try {
      const { period } = req.query;

      if (!period || !['daily', 'weekly', 'monthly'].includes(period as string)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid period. Use: daily, weekly, or monthly',
        });
      }

      const performance = await reportService.getMerchantPerformance(
        period as 'daily' | 'weekly' | 'monthly'
      );

      res.json({
        success: true,
        data: performance,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getReportComparison(req: AuthRequest, res: Response) {
    try {
      const comparison = await reportService.getReportComparison();

      res.json({
        success: true,
        data: comparison,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async exportCSV(req: AuthRequest, res: Response) {
    try {
        const { period } = req.query;

        if (!period || !['daily', 'weekly', 'monthly'].includes(period as string)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid period. Use: daily, weekly, or monthly',
        });
        }

        const csv = await reportService.generateCSV(
        period as 'daily' | 'weekly' | 'monthly'
        );

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=report-${period}-${Date.now()}.csv`);
        res.send(csv);
    } catch (error: any) {
        res.status(500).json({
        success: false,
        message: error.message,
        });
    }
  }
}