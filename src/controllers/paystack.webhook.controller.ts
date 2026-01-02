import { Request, Response } from 'express';
import crypto from 'crypto';
import { OrderService } from '../services/customerOrder.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { InvoiceService } from '../services/invoice.service';

const orderService = new OrderService();
const whatsappService = new WhatsAppService();
const invoiceService = new InvoiceService();

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
    const amountPaid = data.amount / 100; // Convert from kobo

    // Update order status
    await orderService.updatePaymentStatus(reference, 'PAID');

    // Get order details
    const order = await orderService.getOrderByReference(reference);

    if (!order) return;

    // Generate invoice
    const { invoice, pdfPath } = await invoiceService.createInvoice(order.id);

    console.log('Invoice generated:', { invoiceNumber: invoice.invoiceNumber, pdfPath });

    // Send confirmation to customer
    const confirmationMessage = `
    ✅ Payment Confirmed!
    Order Number: ${order.orderNumber}
    Invoice Number: ${invoice.invoiceNumber}
    Amount Paid: ₦${amountPaid.toLocaleString()}

    Your invoice has been generated. Your order is being processed.

    We'll notify you when it's ready for delivery. 🎉
    `.trim();

    await whatsappService.sendMessage(order.customerPhone, confirmationMessage);

    // TODO: Send PDF invoice via WhatsApp

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
}