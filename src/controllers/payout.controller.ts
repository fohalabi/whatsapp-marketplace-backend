import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { PayoutService } from '../services/payout.service';

const payoutService = new PayoutService();

export class PayoutController {
  async getMerchantPayouts(req: AuthRequest, res: Response) {
    try {
      const payouts = await payoutService.getMerchantPayouts();

      res.json({
        success: true,
        data: payouts,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async processSinglePayout(req: AuthRequest, res: Response) {
    try {
      const { merchantId } = req.params;

      if (!merchantId) {
        return res.status(400).json({
            success: false,
            message: 'Merchant ID is required',
        });
      }

      await payoutService.processPayout(merchantId);

      res.json({
        success: true,
        message: 'Payout processed successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async processBulkPayouts(req: AuthRequest, res: Response) {
    try {
      const { merchantIds } = req.body;

      if (!Array.isArray(merchantIds) || merchantIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'merchantIds array is required',
        });
      }

      await payoutService.processBulkPayouts(merchantIds);

      res.json({
        success: true,
        message: `${merchantIds.length} payouts processed successfully`,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}