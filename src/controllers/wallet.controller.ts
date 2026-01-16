import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { WalletService } from '../services/wallet.service';
import prisma from '../config/database';

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
      
      // verify merchant owns this wallet
      if (req.user?.role === 'MERCHANT') {
        const merchant = await prisma.merchant.findUnique({
          where: { userId: req.user.userId }
        });

        if (merchant?.id !== merchantId) {
          return res.status(403).json({
            success: false,
            message: 'You can only access your own wallet',
          });
        }
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

      // Verify merchant owns this wallet (unless admin)
      if (req.user?.role === 'MERCHANT') {
        const merchant = await prisma.merchant.findUnique({
          where: { userId: req.user.userId }
        });

        if (merchant?.id !== merchantId ) {
          return res.status(403).json({
            success: false,
            message: 'You can only access your own transactions',
          });
        }
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

      // Verify merchant owns this wallet
      const merchant = await prisma.merchant.findUnique({
        where: { userId: req.user!.userId }
      });

      if (merchant?.id !== merchantId) {
        return res.status(403).json({
          success: false,
          message: 'You can only withdraw from your own wallet',
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

  async getMerchantDashboardData(req: AuthRequest, res: Response) {
    try {
      const { merchantId } = req.params;

      if (!merchantId) {
        return res.status(400).json({
          success: false,
          message: 'Merchant ID is required',
        });
      }

      // Verify merchant owns this wallet (unless admin)
      if (req.user?.role === 'MERCHANT') {
        const merchant = await prisma.merchant.findUnique({
          where: { userId: req.user.userId }
        });
        if (merchant?.id !== merchantId) {
          return res.status(403).json({
            success: false,
            message: 'You can only access your own dashboard',
          });
        }
      }

      const [wallet, pendingBalance, transactions] = await Promise.all([
        walletService.getOrCreateMerchantWallet(merchantId),
        walletService.getMerchantPendingBalance(merchantId),
        walletService.getMerchantTransactions(merchantId, 10)
      ]);

   

      res.json({
        success: true,
        data: {
          availableBalance: wallet.balance,
          pendingBalance,
          totalEarnings: wallet.totalEarnings,
          totalWithdrawals: wallet.totalWithdrawals,
          recentTransactions: transactions
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getPlatformRevenue(req: AuthRequest, res: Response) {
    try {
      const platformWallet = await walletService.getPlatformWallet();

      res.json({
        success: true,
        data: {
          totalRevenue: platformWallet.totalRevenue,
          totalPayouts: platformWallet.totalPayouts,
          currentBalance: platformWallet.currentBalance,
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async withdrawFromPlatform(req: AuthRequest, res: Response) {
    try {
      const { amount, bankAccountName, bankAccountNumber, bankName } = req.body;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
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

      const result = await walletService.debitPlatformWallet(
        adminId,
        amount,
        { accountName: bankAccountName, accountNumber: bankAccountNumber, bankName }
      );

      res.json({
        success: true,
        message: 'Platform withdrawal processed successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getAllMerchnatWallets(req: AuthRequest, res: Response) {
    try {
      const wallets = await walletService.getAllMerchantWallets();

      res.json({
        success: true,
        data: wallets,
      })
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getPlatformTransactions(req: AuthRequest, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;

      const transactions = await prisma.platformWalletTransaction.findMany({
        include: {
          admin: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

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
}