import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { RiderWalletService } from '../services/riderWallet.service';
import prisma from '../config/database';

const riderWalletService = new RiderWalletService();

export class RiderWalletController {
  async getBalance(req: AuthRequest, res: Response) {
    try {
      const balance = await riderWalletService.getWalletBalance(req.user!.userId);

      res.json({
        success: true,
        data: balance,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getTransactions(req: AuthRequest, res: Response) {
    try {
      const transactions = await riderWalletService.getTransactions(req.user!.userId);

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
      const { amount, bankDetails } = req.body;

      if (!amount || !bankDetails) {
        return res.status(400).json({
          success: false,
          message: 'Amount and bank details required',
        });
      }

      const result = await riderWalletService.requestWithdrawal(
        req.user!.userId,
        amount,
        bankDetails
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getWithdrawalHistory(req: AuthRequest, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;

      const rider = await prisma.rider.findUnique({
        where: { userId: req.user!.userId },
      });

      if (!rider) {
        return res.status(404).json({
          success: false,
          message: 'Rider not found',
        });
      }

      const withdrawals = await prisma.riderWalletTransaction.findMany({
        where: { 
          riderId: rider.id,
          type: 'WITHDRAWAL'
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      res.json({
        success: true,
        data: withdrawals,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getAllRiderWallets(req: AuthRequest, res: Response) {
    try {
      const wallets = await riderWalletService.getAllRiderWallets();
      res.json({
        success: true,
        data: wallets,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}