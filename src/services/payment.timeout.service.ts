import prisma from '../config/database';
import { WhatsAppService } from './whatsapp.service';

const whatsappService = new WhatsAppService();

export class PaymentTimeoutService {
  async cancelExpiredOrders() {
    const expiredOrders = await prisma.customerOrder.findMany({
      where: {
        paymentStatus: 'PENDING',
        paymentExpiresAt: {
          lte: new Date(), // Expired
        },
      },
    });

    for (const order of expiredOrders) {
      // Update order status
      await prisma.customerOrder.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'FAILED',
          status: 'CANCELLED',
        },
      });

      // Notify customer
      await whatsappService.sendMessage(
        order.customerPhone,
        `⏱️ Payment Timeout
Order Number: ${order.orderNumber}

Your payment window has expired. Please place a new order if you still want to proceed.`
      );

      console.log('Order cancelled due to timeout:', order.orderNumber);
    }
  }
}