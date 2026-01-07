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

    const newBalance = wallet.balance + amount;
    const newTotalEarnings = wallet.totalEarnings + amount;

    // Update wallet
    await prisma.merchantWallet.update({
      where: { id: wallet.id },
      data: {
        balance: newBalance,
        totalEarnings: newTotalEarnings,
      },
    });

    // Record transaction
    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount,
        balanceAfter: newBalance,
        orderId,
        reference: `CREDIT_${Date.now()}_${orderId}`,
        description: `Earnings from order ${orderId}`,
      },
    });

    console.log('Merchant wallet credited:', { merchantId, amount, newBalance });
  }

  // Debit merchant wallet (withdrawal)
  async debitMerchantWallet(merchantId: string, amount: number) {
    const wallet = await this.getOrCreateMerchantWallet(merchantId);

    if (wallet.balance < amount) {
      throw new Error('Insufficient wallet balance');
    }

    const newBalance = wallet.balance - amount;
    const newTotalWithdrawals = wallet.totalWithdrawals + amount;

    // Update wallet
    await prisma.merchantWallet.update({
      where: { id: wallet.id },
      data: {
        balance: newBalance,
        totalWithdrawals: newTotalWithdrawals,
      },
    });

    // Record transaction
    const transaction = await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'WITHDRAWAL',
        amount,
        balanceAfter: newBalance,
        reference: `WITHDRAWAL_${Date.now()}`,
        description: `Withdrawal request`,
      },
    });

    console.log('Merchant wallet debited:', { merchantId, amount, newBalance });
    return transaction;
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
}