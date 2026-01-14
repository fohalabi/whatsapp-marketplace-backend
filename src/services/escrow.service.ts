import prisma from '../config/database';
import { WalletService } from './wallet.service';

export class EscrowService {
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  async releaseEscrowToPayout(orderId: string) {
    const escrow = await prisma.escrow.findUnique({
      where: { orderId },
      include: { 
        order: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
            delivery: {
              include: {
                rider: true
              }
            }
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

    // Calculate delivery fee split
    const deliveryFee = escrow.deliveryFeeAmount;
    const riderAmount = deliveryFee * 0.8; // 80% to rider
    const platformDeliveryFee = deliveryFee * 0.2; // 20% to platform

    // Execute transaction
    await prisma.$transaction(async (tx) => {
      // Update escrow to RELEASED
      await tx.escrow.update({
        where: { id: escrow.id },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
        },
      });

      // Create payout for merchant (products only)
      await tx.payout.create({
        data: {
          orderId: escrow.orderId,
          merchantId: escrow.merchantId,
          amount: merchantEarnings,
          status: 'PENDING',
        },
      });

      // Add delivery fee to rider wallet
      if (escrow.order.delivery?.riderId) {
        await tx.rider.update({
          where: { id: escrow.order.delivery.riderId },
          data: {
            walletBalance: { increment: riderAmount },
            totalEarnings: { increment: riderAmount }
          }
        });

        // Create delivery fee transaction record
        await tx.deliveryFeeTransaction.create({
          data: {
            deliveryId: escrow.order.delivery.id,
            riderId: escrow.order.delivery.riderId,
            totalFee: deliveryFee,
            riderAmount,
            platformAmount: platformDeliveryFee,
            status: 'COMPLETED',
            completedAt: new Date()
          }
        });
      }

      // Update platform wallet
      await this.walletService.updatePlatformWallet(
        platformCommission + platformDeliveryFee, // Total platform earnings
        0,
        platformDeliveryFee
      );
    });

    console.log('Escrow released:', { 
      orderId, 
      merchantEarnings, 
      platformCommission,
      riderAmount,
      platformDeliveryFee
    });

    return { merchantEarnings, platformCommission, riderAmount, platformDeliveryFee };
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