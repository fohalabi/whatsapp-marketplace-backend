import prisma from '../config/database';
import { EscrowService } from '../services/escrow.service';

const escrowService = new EscrowService();

export async function autoReleaseExpiredDeliveries() {
  try {
    const now = new Date();

    // Find deliveries past auto-release time
    const expiredDeliveries = await prisma.delivery.findMany({
      where: {
        status: 'DELIVERED',
        customerConfirmed: false,
        autoReleaseAt: { lte: now }
      },
      include: { order: true }
    });

    console.log(`🔄 Auto-releasing ${expiredDeliveries.length} expired deliveries...`);

    for (const delivery of expiredDeliveries) {
      try {
        // Mark as confirmed
        await prisma.$transaction([
          prisma.delivery.update({
            where: { id: delivery.id },
            data: {
              customerConfirmed: true,
              customerConfirmedAt: now
            }
          }),
          prisma.customerOrder.update({
            where: { id: delivery.orderId },
            data: {
              deliveryConfirmed: true,
              deliveryConfirmedAt: now
            }
          })
        ]);

        // Release escrow
        await escrowService.releaseEscrowToPayout(delivery.orderId);

        console.log(`✅ Auto-released: ${delivery.deliveryNumber}`);
      } catch (error: any) {
        console.error(`❌ Auto-release failed for ${delivery.deliveryNumber}:`, error.message);
      }
    }
  } catch (error: any) {
    console.error('❌ Auto-release job error:', error.message);
  }
}

// Run every hour
export function startAutoReleaseJob() {
  setInterval(autoReleaseExpiredDeliveries, 60 * 60 * 1000);
  console.log('✅ Auto-release job started (runs hourly)');
}