import prisma from '../config/database';

export class EscrowService {
  async releaseEscrowToPayout(orderId: string) {
    const escrow = await prisma.escrow.findUnique({
      where: { orderId },
      include: { order: true },
    });

    if (!escrow) throw new Error('Escrow not found');
    if (escrow.status !== 'HELD') throw new Error('Escrow already released');

    // Update escrow to RELEASED
    await prisma.escrow.update({
      where: { id: escrow.id },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
      },
    });

    // Create payout entry
    await prisma.payout.create({
      data: {
        orderId: escrow.orderId,
        merchantId: escrow.merchantId,
        amount: escrow.amount,
        status: 'PENDING',
      },
    });

    console.log('Escrow released to payout:', { orderId });
  }

  async getEscrowByOrderId(orderId: string) {
    return await prisma.escrow.findUnique({
      where: { orderId },
      include: { order: true },
    });
  }

  async getMerchantEscrowBalance(merchantId: string) {
    const escrows = await prisma.escrow.findMany({
      where: {
        merchantId,
        status: 'HELD',
      },
    });

    return escrows.reduce((sum, e) => sum + e.amount, 0);
  }
}