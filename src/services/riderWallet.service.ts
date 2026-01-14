import prisma from '../config/database';
import { PaystackService } from './paystack.service';

export class RiderWalletService {
  private paystackService: PaystackService;

  constructor() {
    this.paystackService = new PaystackService();
  }

  async getWalletBalance(userId: string) {
    const rider = await prisma.rider.findUnique({
      where: { userId },
      select: {
        walletBalance: true,
        totalEarnings: true,
      },
    });

    if (!rider) throw new Error('Rider not found');

    return {
      balance: rider.walletBalance,
      totalEarnings: rider.totalEarnings,
    };
  }

  async getTransactions(userId: string, limit = 50) {
    const rider = await prisma.rider.findUnique({
      where: { userId },
    });

    if (!rider) throw new Error('Rider not found');

    const transactions = await prisma.deliveryFeeTransaction.findMany({
      where: { riderId: rider.id },
      include: {
        delivery: {
          select: {
            deliveryNumber: true,
            createdAt: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });

    return transactions;
  }

  async requestWithdrawal(
    userId: string,
    amount: number,
    bankDetails: {
      accountName: string;
      accountNumber: string;
      bankName: string;
    }
  ) {
    const rider = await prisma.rider.findUnique({
      where: { userId },
    });

    if (!rider) throw new Error('Rider not found');

    if (rider.walletBalance < amount) {
      throw new Error('Insufficient balance');
    }

    // Deduct from rider wallet
    const updatedRider = await prisma.rider.update({
      where: { id: rider.id },
      data: {
        walletBalance: { decrement: amount },
      },
    });

    // Initiate Paystack transfer
    try {
      const bankCode = await this.paystackService.getBankCodeByName(bankDetails.bankName);

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

      const reference = `RIDER_WD_${Date.now()}`;

      await this.paystackService.initiateTransfer(
        amount,
        recipient.recipient_code,
        bankCode,
        bankDetails.accountName,
        reference,
        'Rider withdrawal'
      );

      console.log('Rider withdrawal successful:', reference);

      return { success: true, amount, reference };
    } catch (error: any) {
      // Rollback on failure
      await prisma.rider.update({
        where: { id: rider.id },
        data: {
          walletBalance: { increment: amount },
        },
      });

      throw new Error(`Withdrawal failed: ${error.message}`);
    }
  }
}