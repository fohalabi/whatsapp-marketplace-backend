import prisma from '../config/database';
import { WalletService } from './wallet.service';

export class PayoutService {
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  async getMerchantPayouts() {
    const merchants = await prisma.merchant.findMany({
      include: {
        user: true,
      },
    });

    const payoutData = await Promise.all(
      merchants.map(async (merchant) => {
        // Available balance (PENDING payouts)
        const availablePayouts = await prisma.payout.findMany({
          where: {
            merchantId: merchant.id,
            status: 'PENDING',
          },
        });

        const availableBalance = availablePayouts.reduce((sum, p) => sum + p.amount, 0);

        // Pending balance (HELD escrow)
        const pendingEscrows = await prisma.escrow.findMany({
          where: {
            merchantId: merchant.id,
            status: 'HELD',
          },
        });

        const pendingBalance = pendingEscrows.reduce((sum, e) => sum + e.amount, 0);

        // Last payout
        const lastPayout = await prisma.payout.findFirst({
          where: {
            merchantId: merchant.id,
            status: 'COMPLETED',
          },
          orderBy: { paidOutAt: 'desc' },
        });

        return {
          id: merchant.id,
          merchantName: merchant.businessName,
          availableBalance,
          pendingBalance,
          lastPayoutDate: lastPayout?.paidOutAt || null,
          lastPayoutAmount: lastPayout?.amount || 0,
        };
      })
    );

    return payoutData;
  }

  async processPayout(merchantId: string) {
    const payouts = await prisma.payout.findMany({
      where: {
        merchantId,
        status: 'PENDING',
      },
    });

    if (payouts.length === 0) throw new Error('No pending payouts');

    const totalAmount = payouts.reduce((sum, p) => sum + p.amount, 0);

    await prisma.$transaction(async (tx) => {
      // Mark payouts as completed
      await tx.payout.updateMany({
        where: {
          merchantId,
          status: 'PENDING',
        },
        data: {
          status: 'COMPLETED',
          paidOutAt: new Date(),
        },
      });

      // Credit merchant wallet
      for (const payout of payouts) {
        await this.walletService.creditMerchantWallet(
          merchantId,
          payout.amount,
          payout.orderId
        );
      }
    });

    console.log('Payout processed and wallet credited:', { merchantId, totalAmount, count: payouts.length });
  }

  async processBulkPayouts(merchantIds: string[]) {
    const results = {
      successful: [] as string[],
      failed: [] as Array<{ merchantId: string; error: string }>
    };

    for (const merchantId of merchantIds) {
      try {
        await this.processPayout(merchantId);
        results.successful.push(merchantId);
      } catch (error: any) {
        results.failed.push({
          merchantId,
          error: error.message
        });
      }
    }

    console.log('Bulk payout completed:', {
      total: merchantIds.length,
      successful: results.successful.length,
      failed: results.failed.length
    });

    return results;
  }
}