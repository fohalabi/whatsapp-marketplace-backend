import prisma from '../config/database';
import cron from 'node-cron';

export class OrderCleanupJob {
  start() {
    // Run every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
      await this.cleanupExpiredOrders();
    });
    
    console.log('✅ Order cleanup job started');
  }

  private async cleanupExpiredOrders() {
    const now = new Date();

    // Find expired unpaid orders
    const expiredOrders = await prisma.customerOrder.findMany({
      where: {
        paymentStatus: 'PENDING',
        paymentExpiresAt: { lt: now }
      },
      include: {
        items: true
      }
    });

    for (const order of expiredOrders) {
      // Restore stock
      for (const item of order.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { increment: item.quantity }
          }
        });
      }

      // Mark order as expired
      await prisma.customerOrder.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'FAILED'
        }
      });

      console.log(`🔄 Stock restored for expired order: ${order.orderNumber}`);
    }
  }
}