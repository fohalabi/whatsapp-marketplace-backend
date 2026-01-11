import prisma from '../config/database';

export class WalletService {
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
  async updatePlatformWallet(revenue: number, payout: number) {
    let platformWallet = await prisma.platformWallet.findFirst();

    if (!platformWallet) {
      platformWallet = await prisma.platformWallet.create({
        data: {
          totalRevenue: revenue,
          totalPayouts: payout,
          currentBalance: revenue - payout,
        },
      });
    } else {
      await prisma.platformWallet.update({
        where: { id: platformWallet.id },
        data: {
          totalRevenue: { increment: revenue },
          totalPayouts: { increment: payout },
          currentBalance: { increment: revenue - payout },
        },
      });
    }

    console.log('Platform wallet updated:', { revenue, payout });
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
}