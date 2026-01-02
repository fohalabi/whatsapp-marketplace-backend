import { Request, Response } from 'express';
import prisma from '../config/database';
import { OrderService } from '../services/customerOrder.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { PaystackService } from '../services/paystack.service';

export class WhatsAppWebhookController {
  private orderService: OrderService;
  private paystackService: PaystackService;

  constructor() {
    this.orderService = new OrderService();
    this.paystackService = new PaystackService();
  }

  // Verify webhook (Meta will call this during setup)
  verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'your_verify_token';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified!');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }

  // Receive incoming messages
  async receiveMessage(req: Request, res: Response) {
    try {
      const body = req.body;
      
      // Acknowledge receipt immediately
      res.sendStatus(200);

      // Check if it's an order from catalog
      if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.type === 'order') {
        await this.handleOrder(body);
      }
      // Regular text message
      else if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.type === 'text') {
        await this.handleTextMessage(body);
      }
    } catch (error) {
      console.error('Webhook error:', error);
    }
  }

  private async handleOrder(body: any) {
    const orderData = body.entry[0].changes[0].value.messages[0];
    const customerPhone = orderData.from;
    const order = orderData.order;

    // Check if customer has existing pending order
    const existingPendingOrder = await prisma.customerOrder.findFirst({
      where: {
        customerPhone,
        paymentStatus: 'PENDING',
      },
    });

    if (existingPendingOrder) {
      const whatsappService = new WhatsAppService();
      await whatsappService.sendMessage(
        customerPhone,
        `⚠️ You already have a pending order (${existingPendingOrder.orderNumber}).
        Please complete payment for that order first before placing a new one.`
      );
      return;
    }

    // Extract order items
    const items = order.product_items.map((item: any) => ({
      productId: item.product_retailer_id,
      quantity: item.quantity,
      price: item.item_price,
    }));

    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

    // Create pending order (waiting for email)
    const createdOrder = await this.orderService.createPendingOrder(
      customerPhone,
      items,
      totalAmount
    );

    console.log('Order created, awaiting email:', { customerPhone, totalAmount });

    // Ask for email
    const whatsappService = new WhatsAppService();
    const emailRequestMessage = `
✅ Order Received! 
Order Number: ${createdOrder.orderNumber}
Total Amount: ₦${totalAmount.toLocaleString()}

📧 Please reply with your email address to receive your receipt and invoice.

Or type SKIP if you don't want to provide an email.
    `.trim();

    await whatsappService.sendMessage(customerPhone, emailRequestMessage);
  }

  private async handleTextMessage(body: any) {
    const message = body.entry[0].changes[0].value.messages[0];
    const from = message.from;
    const text = message.text?.body || '';

    // Check if user has pending email collection
    const pendingOrder = await this.orderService.getPendingEmailOrder(from);

    if (pendingOrder) {
      // User is responding with email or SKIP
      await this.handleEmailResponse(from, text, pendingOrder);
    } else {
      // Regular message - save to admin chat
      await prisma.customerMessage.create({
        data: {
          messageId: message.id,
          from,
          message: text,
        },
      });

      console.log('Message saved:', { from, text });
    }
  }

  private async handleEmailResponse(customerPhone: string, text: string, order: any) {
    const whatsappService = new WhatsAppService();

    // Check if user typed SKIP
    if (text.toUpperCase().trim() === 'SKIP') {
      // Update order with generated email
      await this.orderService.updateEmailAndProceed(order.orderNumber, '', true);
      
      // Proceed to payment
      await this.sendPaymentLink(customerPhone, order, `noreply-${Date.now()}@yourdomain.com`);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text.trim())) {
      await whatsappService.sendMessage(
        customerPhone,
        '❌ Invalid email format. Please send a valid email address or type SKIP.'
      );
      return;
    }

    // Update order with collected email
    await this.orderService.updateEmailAndProceed(order.orderNumber, text.trim(), false);

    // Proceed to payment
    await this.sendPaymentLink(customerPhone, order, text.trim());
  }

  private async sendPaymentLink(customerPhone: string, order: any, email: string) {
    const whatsappService = new WhatsAppService();

    // Initialize Paystack payment
    const payment = await this.paystackService.initializePayment(
      email,
      order.totalAmount,
      order.paymentReference
    );

    console.log('Payment link generated:', { customerPhone, email });

    // Send payment link
    const paymentMessage = `
✅ Thank you! 
Order Number: ${order.orderNumber}
Total Amount: ₦${order.totalAmount.toLocaleString()}

Click here to pay: ${payment.authorization_url}

Payment options: Card, Bank Transfer, USSD
    `.trim();

    await whatsappService.sendMessage(customerPhone, paymentMessage);
  }
}