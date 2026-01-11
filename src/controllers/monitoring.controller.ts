import { Request, Response } from 'express';
import { errorLogger } from '../services/errorLogger.service';

export class MonitoringController {
  async getErrorStats(req: Request, res: Response) {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      
      const errors = await errorLogger.getCriticalErrors(hours);
      
      const stats = {
        total: errors.length,
        bySeverity: {
          critical: errors.filter(e => e.severity === 'CRITICAL').length,
          high: errors.filter(e => e.severity === 'HIGH').length
        },
        byService: errors.reduce((acc, e) => {
          acc[e.service] = (acc[e.service] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        recentErrors: errors.slice(0, 10)
      };

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