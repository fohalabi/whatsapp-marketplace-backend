import prisma from '../config/database';
import { PaystackService } from './paystack.service';

export class WalletService {
  private paystackService: PaystackService;

  constructor() {
    this.paystackService = new PaystackService();
  }

  // Get or create merchant wallet
  async getOrCreateMerchantWallet(merchantId: string) {
    let wallet = await prisma.merchantWallet.findUnique({
      where: { merchantId },
    });

    if (!wallet) {
      wallet = await prisma.merchantWallet.create({
        data: { merchantId },
      });
    }

    return wallet;
  }

  // Credit merchant wallet (from escrow release)
  async creditMerchantWallet(merchantId: string, amount: number, orderId: string) {
    const wallet = await this.getOrCreateMerchantWallet(merchantId);

    const updatedWallet = await prisma.merchantWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: amount },
        totalEarnings: { increment: amount }
      },
    });

    // Record transaction
    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount,
        balanceAfter: updatedWallet.balance,
        orderId,
        reference: `CREDIT_${Date.now()}_${orderId}`,
        description: `Earnings from order ${orderId}`,
      },
    });

    console.log('Merchant wallet credited:', { merchantId, amount, newBalance: updatedWallet });
  }

  // Debit merchant wallet (withdrawal)
  async debitMerchantWallet(
    merchantId: string, 
    amount: number,
    bankDetails: {
      accountName: string;
      accountNumber: string;
      bankName: string;
    }
  ) {
    const wallet = await this.getOrCreateMerchantWallet(merchantId);

    if (wallet.balance < amount) {
      throw new Error('Insufficient wallet balance');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.merchantWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: amount },
          totalWithdrawals: { increment: amount },
        },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          amount,
          balanceAfter: updatedWallet.balance,
          reference: `WITHDRAWAL_${Date.now()}`,
          description: `Withdrawal to ${bankDetails.bankName} - ${bankDetails.accountNumber}`,
          metadata: {
            bankAccountName: bankDetails.accountName,
            bankAccountNumber: bankDetails.accountNumber,
            bankName: bankDetails.bankName,
          }
        },
      });

      return { updatedWallet, transaction };
    });

    // Get bank code and initiate Paystack transfer
    try {
      const bankCode = await this.paystackService.getBankCodeByName(bankDetails.bankName);
      
      // Verify account first
      const verification = await this.paystackService.verifyAccountNumber(
        bankDetails.accountNumber,
        bankCode
      );

      if (verification.account_name.toLowerCase() !== bankDetails.accountName.toLowerCase()) {
        throw new Error('Account name mismatch');
      }

      const recipient = await this.paystackService.createTransferRecipient(
        bankDetails.accountNumber,
        bankCode,
        bankDetails.accountName
      );

      await this.paystackService.initiateTransfer(
        amount,
        recipient.recipient_code,
        bankCode,
        bankDetails.accountName,
        result.transaction.reference,
        'Merchant withdrawal'
      );

      console.log('Paystack transfer initiated:', result.transaction.reference);
    } catch (error: any) {
      console.error('Paystack transfer failed:', error.message);
      
      // Rollback wallet debit
      await prisma.merchantWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: amount },
          totalWithdrawals: { decrement: amount },
        },
      });

      // Delete failed transaction
      await prisma.walletTransaction.delete({
        where: { id: result.transaction.id }
      });

      throw new Error(`Bank transfer failed: ${error.message}`);
    }

    // Log activity for admin tracking
    await prisma.activityLog.create({
      data: {
        userId: merchantId,
        action: 'merchant_withdrawal',
        description: `Withdrawal of ${amount} to ${bankDetails.bankName}`,
        metadata: {
          amount,
          bankDetails,
          transactionId: result.transaction.id,
          reference: result.transaction.reference
        }
      }
    });

    console.log('Merchant wallet debited:', { 
      merchantId, 
      amount, 
      newBalance: result.updatedWallet.balance 
    });

    return result.transaction;
  }

  // Get merchant wallet balance
  async getMerchantWalletBalance(merchantId: string) {
    const wallet = await this.getOrCreateMerchantWallet(merchantId);
    return wallet.balance;
  }

  // Get merchant wallet transactions
  async getMerchantTransactions(merchantId: string, limit = 50) {
    const wallet = await this.getOrCreateMerchantWallet(merchantId);

    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return transactions;
  }

  // Update platform wallet
  async updatePlatformWallet(revenue: number, payout: number, deliveryFeeRevenue: number = 0) {
    let platformWallet = await prisma.platformWallet.findFirst();

    if (!platformWallet) {
      platformWallet = await prisma.platformWallet.create({
        data: {
          totalRevenue: revenue,
          totalPayouts: payout,
          currentBalance: revenue - payout,
          deliveryFeeEarnings: deliveryFeeRevenue,
        },
      });
    } else {
      await prisma.platformWallet.update({
        where: { id: platformWallet.id },
        data: {
          totalRevenue: { increment: revenue },
          totalPayouts: { increment: payout },
          currentBalance: { increment: revenue - payout },
          deliveryFeeEarnings: { increment: deliveryFeeRevenue },
        },
      });
    }

    console.log('Platform wallet updated:', { revenue, payout, deliveryFeeRevenue });
  }

  // Get platform wallet
  async getPlatformWallet() {
    let wallet = await prisma.platformWallet.findFirst();

    if (!wallet) {
      wallet = await prisma.platformWallet.create({
        data: {},
      });
    }

    return wallet;
  }

  // Get merchant pending balance (escrow + payout)
  async getMerchantPendingBalance(merchantId: string) {
    const [escrowBalance, payoutBalance] = await Promise.all([
      prisma.escrow.aggregate({
        where: {
          merchantId,
          status: 'HELD',
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.payout.aggregate({
        where: {
          merchantId,
          status: 'PENDING',
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    const totalPending = 
      (escrowBalance._sum.amount || 0) + 
      (payoutBalance._sum.amount || 0);

    return totalPending;
  }

  // Admin withdrawal from platform wallet
  async debitPlatformWallet(
    adminId: string,
    amount: number,
    bankDetails: {
      accountName: string;
      accountNumber: string;
      bankName: string;
    }
  ) {
    const platformWallet = await this.getPlatformWallet();

    if (platformWallet.currentBalance < amount) {
      throw new Error('Insufficient platform balance');
    }

    await prisma.$transaction(async (tx) => {
      await tx.platformWallet.update({
        where: { id: platformWallet.id },
        data: {
          currentBalance: { decrement: amount },
          totalPayouts: { increment: amount },
        },
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: adminId,
          action: 'platform_withdrawal',
          description: `Platform withdrawal of ${amount} to ${bankDetails.bankName}`,
          metadata: {
            amount,
            bankDetails,
            reference: `PLATFORM_WD_${Date.now()}`
          }
        }
      });
    });

    // Get bank code and initiate Paystack transfer
    try {
      const bankCode = await this.paystackService.getBankCodeByName(bankDetails.bankName);
      
      // Verify account first
      const verification = await this.paystackService.verifyAccountNumber(
        bankDetails.accountNumber,
        bankCode
      );

      if (verification.account_name.toLowerCase() !== bankDetails.accountName.toLowerCase()) {
        throw new Error('Account name mismatch');
      }

      const recipient = await this.paystackService.createTransferRecipient(
        bankDetails.accountNumber,
        bankCode,
        bankDetails.accountName
      );

      const reference = `PLATFORM_WD_${Date.now()}`;

      await this.paystackService.initiateTransfer(
        amount,
        recipient.recipient_code,
        bankCode,
        bankDetails.accountName,
        reference,
        'Platform withdrawal'
      );

      console.log('Platform transfer initiated:', reference);
    } catch (error: any) {
      console.error('Platform transfer failed:', error.message);
      
      // Rollback platform wallet debit
      await prisma.platformWallet.update({
        where: { id: platformWallet.id },
        data: {
          currentBalance: { increment: amount },
          totalPayouts: { decrement: amount },
        },
      });

      throw new Error(`Bank transfer failed: ${error.message}`);
    }

    console.log('Platform wallet debited:', { adminId, amount });
    return { success: true, amount };
  }

  // Get all merchant wallets for admin
  async getAllMerchantWallets() {
    const wallets = await prisma.merchantWallet.findMany({
      include: {
        merchant: {
          include: {
            user: {
              select: {
                email: true,
                phone: true
              }
            }
          }
        },
        _count: {
          select: {
            transactions: true
          }
        }
      },
      orderBy: { balance: 'desc' }
    });

    return wallets.map(wallet => ({
      id: wallet.id,
      merchantId: wallet.merchantId,
      merchantName: wallet.merchant.businessName,
      phone: wallet.merchant.phone,
      email: wallet.merchant.user.email,
      balance: wallet.balance,
      totalEarnings: wallet.totalEarnings,
      totalWithdrawals: wallet.totalWithdrawals,
      transactionCount: wallet._count.transactions,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt
    }));
  }
}