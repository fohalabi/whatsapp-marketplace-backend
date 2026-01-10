import { Request, Response } from 'express';
import crypto from 'crypto';
import { OrderService } from '../services/customerOrder.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { InvoiceService } from '../services/invoice.service';
import path from 'path';
import { getRedis } from '../config/redis';
import prisma from '../config/database';
import { DeliveryOrchestrator } from '../services/delivery/DeliveryOrchestrator.service';

const orderService = new OrderService();
const whatsappService = new WhatsAppService();
const invoiceService = new InvoiceService();
const processWebhooks = new Set<string>();

export class PaystackWebhookController {
  async handleWebhook(req: Request, res: Response) {
    try {
      // Verify Paystack signature
      const hash = crypto
        .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (hash !== req.headers['x-paystack-signature']) {
        console.log('Invalid signature');
        return res.sendStatus(400);
      }

      const event = req.body;
      const webhookId = `${event.event}-${event.data.reference}`;

      // Check if already processed
      const redis = getRedis();
      const waSet = await redis.set(webhookId, '1', 'EX', 86400, 'NX');

      if(!waSet) {
        console.log('⚠️ Webhook already processed:', webhookId);
        return res.sendStatus(200);
      }

      // Mark as processed
      await redis.setex(webhookId, 86400, '1');

      // Handle successful payment
      if (event.event === 'charge.success') {
        await this.handleSuccessfulPayment(event.data);
      }

      // Handle failed payment
      if (event.event === 'charge.failed') {
        await this.handleFailedPayment(event.data)
      }

      res.sendStatus(200);
    } catch (error) {
      console.error('Paystack webhook error:', error);
      res.sendStatus(500);
    }
  }

  private async handleSuccessfulPayment(data: any) {
    const reference = data.reference;
    const amountPaid = data.amount / 100;

    const order = await orderService.getOrderByReference(reference);
    if (!order) return;

    // Amount verification (outside transaction - read-only check)
    if (amountPaid !== order.totalAmount) {
      console.error('⚠️ Payment amount mismatch', {
        orderId: order.id,
        expected: order.totalAmount,
        received: amountPaid,
        reference
      });
      return;
    }

    // Execute all database operations in a transaction
    const { invoice, pdfUrl } = await prisma.$transaction(async (tx) => {
      // Update payment status
      await tx.customerOrder.update({
        where: { paymentReference: reference },
        data: { 
          paymentStatus: 'PAID',
          status: 'PROCESSING'
        }
      });

      // Create escrow
      await tx.escrow.create({
        data: {
          orderId: order.id,
          merchantId: order.merchantId,
          amount: order.totalAmount,
          status: 'HELD',
        },
      });

      // Generate invoice (returns invoice data)
      return await invoiceService.createInvoice(order.id);
    });

    // External API calls AFTER transaction (can retry if fail)
    try {
      await whatsappService.sendDocument(
        order.customerPhone,
        pdfUrl,
        `✅ Payment Confirmed! Invoice #${invoice.invoiceNumber}`,
        `${invoice.invoiceNumber}.pdf`
      );

      const confirmationMessage = `
        ✅ Payment Confirmed!
        Order Number: ${order.orderNumber}
        Invoice Number: ${invoice.invoiceNumber}
        Amount Paid: ₦${amountPaid.toLocaleString()}

        Your order is being processed. We'll notify you when it's ready for delivery.

        Thank you for your purchase! 🎉
      `.trim();

      await whatsappService.sendMessage(order.customerPhone, confirmationMessage);
    } catch (whatsappError) {
      console.error('⚠️ WhatsApp notification failed (order still processed):', whatsappError);
      // Don't throw - payment already confirmed
    }

    // Delivery creation (separate from transaction)
    try {
      const deliveryOrchestrator = new DeliveryOrchestrator();
      await deliveryOrchestrator.createDelivery(order.id);
      console.log('✅ Delivery created for order:', order.orderNumber);
    } catch (error: any) {
      console.error('⚠️ Delivery creation failed:', error.message);
    }

    console.log('Payment confirmed and invoice sent:', { reference, amountPaid });
  }

  private async handleFailedPayment(data: any) {
    const reference = data.reference;

    // Update order status
    await orderService.updatePaymentStatus(reference, 'FAILED');

    // Get order details
    const order = await orderService.getOrderByReference(reference);

    if (!order) return;

    // Notify customer
    const failureMessage = `
    ❌ Payment Failed
    Order Number: ${order.orderNumber}

    Your payment was not successful. Please try again or contact support if you need help.

    You can retry payment by placing a new order.
    `.trim();

    await whatsappService.sendMessage(order.customerPhone, failureMessage);

    console.log('Payment failed:', { reference });
    }
}