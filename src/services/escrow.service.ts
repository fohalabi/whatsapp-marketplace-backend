import prisma from '../config/database';

export class EscrowService {
  async releaseEscrowToPayout(orderId: string) {
    const escrow = await prisma.escrow.findUnique({
      where: { orderId },
      include: { 
        order: {
          include: {
            items: {
              include: {
                product: true, // Need product to get wholesale price
              },
            },
          },
        },
      },
    });

    if (!escrow) throw new Error('Escrow not found');
    if (escrow.status !== 'HELD') throw new Error('Escrow already released');

    // Calculate merchant earnings (wholesale prices)
    const merchantEarnings = escrow.order.items.reduce((sum, item) => {
      return sum + (item.product.price * item.quantity);
    }, 0);

    // Calculate platform commission (markup amounts)
    const platformCommission = escrow.order.items.reduce((sum, item) => {
      const markup = (item.product.retailPrice || item.product.price) - item.product.price;
      return sum + (markup * item.quantity);
    }, 0);

    // Update escrow to RELEASED
    await prisma.escrow.update({
      where: { id: escrow.id },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
      },
    });

    // Create payout entry with merchant earnings only
    await prisma.payout.create({
      data: {
        orderId: escrow.orderId,
        merchantId: escrow.merchantId,
        amount: merchantEarnings,
        status: 'PENDING',
      },
    });

    console.log('Escrow released:', { 
      orderId, 
      merchantEarnings, 
      platformCommission 
    });

    return { merchantEarnings, platformCommission };
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