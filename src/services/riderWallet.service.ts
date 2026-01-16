import prisma from '../config/database';
import { upload } from '../utils/upload.utils';
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
        id: true,
        walletBalance: true,
        totalEarnings: true,
      },
    });

    if (!rider) throw new Error('Rider not found');

    // Calculate pending balance (deliveries completed but not confirmed)
    const pendingTransactions = await prisma.deliveryFeeTransaction.findMany({
      where: {
        riderId: rider.id,
        status: 'PENDING', // Not yet confirmed by customer
      },
    });

    const pendingBalance = pendingTransactions.reduce(
      (sum, tx) => sum + tx.riderAmount,
      0
    );

    return {
      balance: rider.walletBalance, // Available to withdraw
      totalEarnings: rider.totalEarnings,
      pendingBalance, // Waiting for customer confirmation
    };
  }

  async getTransactions(userId: string, limit = 50) {
    const rider = await prisma.rider.findUnique({
      where: { userId },
    });

    if (!rider) throw new Error('Rider not found');

    const transactions = await prisma.riderWalletTransaction.findMany({
      where: { riderId: rider.id },
      orderBy: { createdAt: 'desc' },
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

    const reference = `RIDER_WD_${Date.now()}`;

    // Deduct from rider wallet and create transaction record
    const result = await prisma.$transaction(async (tx) => {
      const updatedRider = await tx.rider.update({
        where: { id: rider.id },
        data: {
          walletBalance: { decrement: amount },
        },
      });

      const transaction = await tx.riderWalletTransaction.create({
        data: {
          riderId: rider.id,
          type: 'WITHDRAWAL',
          amount,
          balanceAfter: updatedRider.walletBalance,
          reference,
          bankDetails,
          status: 'PENDING',
          description: `Withdrawal to ${bankDetails.bankName} - ${bankDetails.accountNumber}`
        }
      });

      return { updatedRider, transaction };
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

      const paystackResponse = await this.paystackService.initiateTransfer(
        amount,
        recipient.recipient_code,
        bankCode,
        bankDetails.accountName,
        reference,
        'Rider withdrawal'
      );

      // Update transaction with Paystack reference and mark as completed
      await prisma.riderWalletTransaction.update({
        where: { id: result.transaction.id },
        data: {
          status: 'COMPLETED',
          paystackReference: paystackResponse.transfer_code || reference,
          completedAt: new Date()
        }
      });

      console.log('Rider withdrawal successful:', reference);

      return { success: true, amount, reference, transaction: result.transaction };
    } catch (error: any) {
      // Rollback on failure
      await prisma.$transaction(async (tx) => {
        await tx.rider.update({
          where: { id: rider.id },
          data: {
            walletBalance: { increment: amount },
          },
        });

        await tx.riderWalletTransaction.update({
          where: { id: result.transaction.id },
          data: {
            status: 'FAILED',
            description: `Withdrawal failed: ${error.message}`
          }
        });
      });

      throw new Error(`Withdrawal failed: ${error.message}`);
    }
  }

  async getAllRiderWallets() {
    const riders = await prisma.rider.findMany({
      include: {
        user: {
          select: {
            email: true,
          }
        }
      },
      orderBy: { walletBalance: 'desc' }
    });

    return riders.map(r => ({
      id: r.id,
      riderId: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      phone: r.phone,
      email: r.user.email,
      walletBalance: r.walletBalance,
      totalEarnings: r.totalEarnings,
      totalDeliveries: r.totalDeliveries,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
  }
}