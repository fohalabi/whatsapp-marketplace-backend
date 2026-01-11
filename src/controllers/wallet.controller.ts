import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { WalletService } from '../services/wallet.service';

const walletService = new WalletService();

export class WalletController {
  // Merchant wallet endpoints
  async getMerchantWallet(req: AuthRequest, res: Response) {
    try {
      const { merchantId } = req.params;

      if (!merchantId) {
        return res.status(400).json({
          success: false,
          message: 'Merchant ID is required',
        });
      }

      const wallet = await walletService.getOrCreateMerchantWallet(merchantId);

      res.json({
        success: true,
        data: wallet,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getMerchantTransactions(req: AuthRequest, res: Response) {
    try {
      const { merchantId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!merchantId) {
        return res.status(400).json({
          success: false,
          message: 'Merchant ID is required',
        });
      }

      const transactions = await walletService.getMerchantTransactions(merchantId, limit);

      res.json({
        success: true,
        data: transactions,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async requestWithdrawal(req: AuthRequest, res: Response) {
    try {
      const { merchantId } = req.params;
      const { amount, bankAccountName, bankAccountNumber, bankName } = req.body;

      if (!merchantId) {
        return res.status(400).json({
          success: false,
          message: 'Merchant ID is required',
        });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid amount is required',
        });
      }

      if (!bankAccountName || !bankAccountNumber || !bankName) {
        return res.status(400).json({
          success: false,
          message: 'Bank details are required',
        });
      }

      const transaction = await walletService.debitMerchantWallet(
        merchantId, 
        amount,
        { accountName: bankAccountName, accountNumber: bankAccountNumber, bankName }
      );

      res.json({
        success: true,
        message: 'Withdrawal processed successfully',
        data: transaction,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
  // Platform wallet endpoints
  async getPlatformWallet(req: AuthRequest, res: Response) {
    try {
      const wallet = await walletService.getPlatformWallet();

      res.json({
        success: true,
        data: wallet,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}