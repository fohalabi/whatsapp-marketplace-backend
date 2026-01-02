import prisma from '../config/database';
import { PaystackService } from './paystack.service';
import { WhatsAppService } from './whatsapp.service';

const paystackService = new PaystackService();
const whatsappService = new WhatsAppService();

export class RefundService {
  async getAllRefunds(status?: string) {
    const where = status && status !== 'All' 
      ? { refundStatus: status as any }
      : { refundStatus: { not: 'NONE' } };

    const refunds = await prisma.customerOrder.findMany({
      where,
      include: {
        items: {
          include: { product: true },
        },
      },
      orderBy: { refundRequestedAt: 'desc' },
    });

    return refunds;
  }

  async requestRefund(orderId: string, reason: string, amount: number) {
    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new Error('Order not found');
    if (order.paymentStatus !== 'PAID') throw new Error('Order not paid');
    if (order.refundStatus !== 'NONE') throw new Error('Refund already requested');

    const updated = await prisma.customerOrder.update({
      where: { id: orderId },
      data: {
        refundStatus: 'REQUESTED',
        refundReason: reason,
        refundAmount: amount,
        refundRequestedAt: new Date(),
      },
    });

    return updated;
  }

  async approveRefund(orderId: string, notes?: string) {
    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new Error('Order not found');
    if (order.refundStatus !== 'REQUESTED') throw new Error('Refund not requested');

    const updated = await prisma.customerOrder.update({
      where: { id: orderId },
      data: {
        refundStatus: 'APPROVED',
        ...(notes !== undefined && { refundNotes: notes }),
      },
    });

    // Notify customer
    await whatsappService.sendMessage(
      order.customerPhone,
      `✅ Refund Approved
Order: ${order.orderNumber}
Amount: ₦${order.refundAmount?.toLocaleString()}

Your refund has been approved and will be processed shortly.`
    );

    return updated;
  }

  async rejectRefund(orderId: string, reason: string) {
    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new Error('Order not found');
    if (order.refundStatus !== 'REQUESTED') throw new Error('Refund not requested');

    const updated = await prisma.customerOrder.update({
      where: { id: orderId },
      data: {
        refundStatus: 'REJECTED',
        refundNotes: reason,
      },
    });

    // Notify customer
    await whatsappService.sendMessage(
      order.customerPhone,
      `❌ Refund Rejected
Order: ${order.orderNumber}

Reason: ${reason}

Please contact support if you have questions.`
    );

    return updated;
  }

  async processRefund(orderId: string) {
    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!order) throw new Error('Order not found');
    if (order.refundStatus !== 'APPROVED') throw new Error('Refund not approved');
    if (!order.paymentReference) throw new Error('No payment reference');

    // Call Paystack refund API
    const refundData = await paystackService.refundPayment(
      order.paymentReference,
      order.refundAmount ?? undefined
    );

    // Update order
    const updated = await prisma.customerOrder.update({
      where: { id: orderId },
      data: {
        refundStatus: 'REFUNDED',
        refundedAt: new Date(),
      },
    });

    // Restore stock
    for (const item of order.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: {
          stockQuantity: {
            increment: item.quantity,
          },
        },
      });
    }

    // Notify customer
    await whatsappService.sendMessage(
      order.customerPhone,
      `💰 Refund Processed
Order: ${order.orderNumber}
Amount: ₦${order.refundAmount?.toLocaleString()}

Your refund has been processed. Funds will reflect in your account within 5-7 business days.

Thank you!`
    );

    console.log('Refund processed:', { orderId, refundData });
    return updated;
  }
}