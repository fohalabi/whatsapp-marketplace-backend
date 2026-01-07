import prisma from '../config/database';
import { WhatsAppService } from './whatsapp.service';
import { PaystackService } from './paystack.service';

const whatsappService = new WhatsAppService();
const paystackService = new PaystackService();

export class AbandonedOrderService {
  async getAbandonedOrders() {
    // Get orders that are pending or expired
    const now = new Date();
    
    const orders = await prisma.customerOrder.findMany({
      where: {
        paymentStatus: 'PENDING',
        status: {
          in: ['PENDING', 'CANCELLED'],
        },
      },
      include: {
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate time remaining for each order
    return orders.map(order => {
      const timeRemaining = order.paymentExpiresAt 
        ? Math.max(0, order.paymentExpiresAt.getTime() - now.getTime())
        : 0;
      
      const isExpired = timeRemaining === 0;
      const minutesRemaining = Math.floor(timeRemaining / (1000 * 60));

      return {
        ...order,
        timeRemaining: minutesRemaining,
        isExpired,
      };
    });
  }

  async resendPaymentLink(orderId: string) {
    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!order) throw new Error('Order not found');
    if (order.paymentStatus !== 'PENDING') throw new Error('Order already paid or cancelled');

    // Check if order expired
    if (order.paymentExpiresAt && order.paymentExpiresAt < new Date()) {
      // Extend expiry by 30 minutes
      const newExpiry = new Date(Date.now() + 30 * 60 * 1000);
      await prisma.customerOrder.update({
        where: { id: orderId },
        data: { paymentExpiresAt: newExpiry },
      });
    }

    // Re-initialize payment (get fresh link)
    const payment = await paystackService.initializePayment(
      order.customerEmail || `noreply-${Date.now()}@yourdomain.com`,
      order.totalAmount,
      order.paymentReference!
    );

    // Send payment link
    const message = `
🔔 Payment Reminder
Order Number: ${order.orderNumber}
Total Amount: ₦${order.totalAmount.toLocaleString()}

Your order is waiting! Complete payment to proceed:
${payment.authorization_url}

Valid for 30 minutes.
    `.trim();

    await whatsappService.sendMessage(order.customerPhone, message);

    console.log('Payment link resent:', { orderId: order.orderNumber });
    return order;
  }

  async cancelOrder(orderId: string) {
    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new Error('Order not found');
    if (order.paymentStatus !== 'PENDING') throw new Error('Cannot cancel paid order');

    const updated = await prisma.customerOrder.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'FAILED',
      },
    });

    // Notify customer
    await whatsappService.sendMessage(
      order.customerPhone,
      `❌ Order Cancelled
Order Number: ${order.orderNumber}

Your order has been cancelled. If you'd like to place a new order, please browse our catalog.`
    );

    console.log('Order cancelled:', { orderId: order.orderNumber });
    return updated;
  }

  async extendTimeout(orderId: string, minutes: number = 30) {
    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new Error('Order not found');
    if (order.paymentStatus !== 'PENDING') throw new Error('Order not pending');

    const newExpiry = new Date(Date.now() + minutes * 60 * 1000);

    const updated = await prisma.customerOrder.update({
      where: { id: orderId },
      data: { paymentExpiresAt: newExpiry },
    });

    console.log('Timeout extended:', { orderId: order.orderNumber, minutes });
    return updated;
  }

  async getStats() {
    const abandonedOrders = await this.getAbandonedOrders();

    const totalOrders = abandonedOrders.length;
    const expiredOrders = abandonedOrders.filter(o => o.isExpired).length;
    const activeOrders = totalOrders - expiredOrders;
    const totalValue = abandonedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    return {
      totalOrders,
      expiredOrders,
      activeOrders,
      totalValue,
    };
  }
}