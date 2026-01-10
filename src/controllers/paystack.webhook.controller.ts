import { Request, Response } from 'express';
import crypto from 'crypto';
import { OrderService } from '../services/customerOrder.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { InvoiceService } from '../services/invoice.service';
import path from 'path';
import { getRedis } from '../config/redis';
import prisma from '../config/database';
import { DeliveryOrchestrator } from '../services/delivery/DeliveryOrchestrator.service';
import { PaystackService } from '../services/paystack.service';

const orderService = new OrderService();
const whatsappService = new WhatsAppService();
const invoiceService = new InvoiceService();
const processWebhooks = new Set<string>();

export class PaystackWebhookController {
  private orderService: OrderService;
  private paystackService: PaystackService;

  constructor() {
    this.orderService = new OrderService();
    this.paystackService = new PaystackService()
  }

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

    // Amount verification
    if (amountPaid !== order.totalAmount) {
      console.error('⚠️ Payment amount mismatch', {
        orderId: order.id,
        expected: order.totalAmount,
        received: amountPaid,
        reference
      });
      return;
    }

    // Re-validate stock availability before confirming payment
    const stockCheck = await this.validateStockAvailability(order.id);

    if (!stockCheck.available) {
      console.error('⚠️ Insufficient stock at payment time', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        issues: stockCheck.issues
      });

      // Initiate refund
      try {
        await this.paystackService.refundPayment(reference, order.totalAmount);
        console.log('✅ Refund initiated for order:', order.orderNumber);
      } catch (refundError) {
        console.error('❌ Refund failed:', refundError);
      }

      // update order status
      await prisma.customerOrder.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'FAILED'
        }
      });

      // Notify customer
      await whatsappService.sendMessage(
        order.customerPhone,
        ` Order Cancelled - Stock Unavailable
        
        Order: ${order.orderNumber}
        
        Unfortunately, some items in your order are no longer in stock. Your payment of ₦${amountPaid.toLocaleString()} will be refunded within 5-7 business days.

        We apologize for the inconvenience.`
      );

      return; 
    }

    // Critical database operations (atomic)
    await prisma.$transaction(async (tx) => {
      await tx.customerOrder.update({
        where: { paymentReference: reference },
        data: { 
          paymentStatus: 'PAID',
          status: 'PROCESSING'
        }
      });

      await tx.escrow.create({
        data: {
          orderId: order.id,
          merchantId: order.merchantId,
          amount: order.totalAmount,
          status: 'HELD',
        },
      });
    });

    // Invoice generation with retry (outside transaction)
    let invoice, pdfUrl;
    try {
      const result = await this.retryInvoiceGeneration(order.id, 3);
      invoice = result.invoice;
      pdfUrl = result.pdfUrl;
    } catch (error: any) {
      console.error('⚠️ Invoice generation failed after retries:', error.message);
      
      await prisma.activityLog.create({
        data: {
          userId: 'SYSTEM',
          action: 'invoice_generation_failed',
          description: `Order ${order.orderNumber} - manual invoice needed`,
        }
      });
      
      invoice = null;
      pdfUrl = null;
    }

    // Send invoice if generated
    if (invoice && pdfUrl) {
      try {
        await whatsappService.sendDocument(
          order.customerPhone,
          pdfUrl,
          `✅ Payment Confirmed! Invoice #${invoice.invoiceNumber}`,
          `${invoice.invoiceNumber}.pdf`
        );
      } catch (error) {
        console.error('⚠️ Invoice delivery failed:', error);
      }
    }

    // Send confirmation message
    try {
      const confirmationMessage = `
        ✅ Payment Confirmed!
        Order Number: ${order.orderNumber}
        ${invoice ? `Invoice Number: ${invoice.invoiceNumber}` : ''}
        Amount Paid: ₦${amountPaid.toLocaleString()}

        Your order is being processed. We'll notify you when it's ready for delivery.

        Thank you for your purchase! 🎉
      `.trim();

      await whatsappService.sendMessage(order.customerPhone, confirmationMessage);
    } catch (error) {
      console.error('⚠️ Confirmation message failed:', error);
    }

    // Create delivery
    try {
      const deliveryOrchestrator = new DeliveryOrchestrator();
      await deliveryOrchestrator.createDelivery(order.id);
      console.log('✅ Delivery created for order:', order.orderNumber);
    } catch (error: any) {
      console.error('⚠️ Delivery creation failed:', error.message);
    }

    console.log('Payment confirmed:', { reference, amountPaid });
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

  private async retryInvoiceGeneration(orderId: string, maxRetries: number) {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await invoiceService.createInvoice(orderId);
      } catch (error: any) {
        lastError = error;
        console.warn(`Invoice generation attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      }
    }

    throw lastError;
  }

  private async validateStockAvailability(orderId: string): Promise<{
    available: boolean;
    issues: Array<{ productId: string; productName: string; required: number; available: number }>;
  }> {
    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    if (!order) {
      return { available: false, issues: [] };
    }

    const issues = [];

    for (const item of order.items) {
      if (item.product.stockQuantity < item.quantity) {
        issues.push({
          productId: item.productId,
          productName: item.product.name,
          required: item.quantity,
          available: item.product.stockQuantity
        });
      }
    }

    return {
      available: issues.length === 0,
      issues
    };
  }
}