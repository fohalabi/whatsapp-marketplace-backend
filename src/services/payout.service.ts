import prisma from '../config/database';

export class PayoutService {
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

    // Mark all as completed
    await prisma.payout.updateMany({
      where: {
        merchantId,
        status: 'PENDING',
      },
      data: {
        status: 'COMPLETED',
        paidOutAt: new Date(),
      },
    });

    console.log('Payout processed:', { merchantId, count: payouts.length });
  }

  async processBulkPayouts(merchantIds: string[]) {
    for (const merchantId of merchantIds) {
      await this.processPayout(merchantId);
    }
  }
}