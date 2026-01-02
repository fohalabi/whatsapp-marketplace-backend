import { Request, Response } from 'express';
import crypto from 'crypto';
import { OrderService } from '../services/customerOrder.service';
import { WhatsAppService } from '../services/whatsapp.service';

const orderService = new OrderService();
const whatsappService = new WhatsAppService();

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

    // Send confirmation to customer
    const confirmationMessage = `
✅ Payment Confirmed!
Order Number: ${order.orderNumber}
Amount Paid: ₦${amountPaid.toLocaleString()}

Your order is being processed. We'll notify you when it's ready for delivery.

Thank you for your purchase! 🎉
    `.trim();

    await whatsappService.sendMessage(order.customerPhone, confirmationMessage);

    console.log('Payment confirmed:', { reference, amountPaid });
  }
}