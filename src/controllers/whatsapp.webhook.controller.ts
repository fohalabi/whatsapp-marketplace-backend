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

    // Extract order items
    const items = order.product_items.map((item: any) => ({
      productId: item.product_retailer_id,
      quantity: item.quantity,
      price: item.item_price,
    }));

    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

    // Generate payment reference
    const paymentReference = `ORDER_${Date.now()}`;
    
    // Customer email (you can ask for this or use a default)
    const customerEmail = `${customerPhone}@customer.com`;

    // Create order in database
    const createdOrder = await this.orderService.createOrder(
      customerPhone, 
      customerEmail,
      items, 
      totalAmount,
      paymentReference
    );

    // Initialize Paystack payment
    const payment = await this.paystackService.initializePayment(
      customerEmail,
      totalAmount,
      paymentReference
    );

    console.log('Order created:', { customerPhone, totalAmount });

    // Send payment link
    const whatsappService = new WhatsAppService();
    const paymentMessage = `
✅ Order Received! 
Order Number: ${createdOrder.orderNumber}
Total Amount: ₦${totalAmount.toLocaleString()}

Click here to pay: ${payment.authorization_url}

Payment options: Card, Bank Transfer, USSD
    `.trim();

    await whatsappService.sendMessage(customerPhone, paymentMessage);
  }

  private async handleTextMessage(body: any) {
    const message = body.entry[0].changes[0].value.messages[0];
    const from = message.from;
    const text = message.text?.body || '';

    // Save to admin chat
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