import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import { whatsappService } from '../services/whatsapp.service';
import { getSocketManager } from '../middleware/socket.middleware';
import { OrderService } from '../services/customerOrder.service';
import { PaystackService } from '../services/paystack.service';

export class WhatsAppWebhookController {
  private orderService: OrderService;
  private paystackService: PaystackService;

  constructor() {
    this.orderService = new OrderService();
    this.paystackService = new PaystackService();
  }

  verifyWebhook = (req: Request, res: Response) => {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'jaspers_market_2024';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook verified');
      res.status(200).send(challenge);
    } else {
      console.log('❌ Webhook verification failed');
      res.sendStatus(403);
    }
  };

  receiveMessage = async (req: Request, res: Response) => {
    try {
      // Verify signature in production
      if (process.env.NODE_ENV === 'production' && process.env.WHATSAPP_WEBHOOK_SECRET) {
        const signature = req.headers['x-hub-signature-256'] as string;
        const expectedSignature = crypto
          .createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET)
          .update(JSON.stringify(req.body))
          .digest('hex');

        if (signature !== `sha256=${expectedSignature}`) {
          console.warn('⚠️ Invalid webhook signature');
          return res.sendStatus(403);
        }
      }

      // Acknowledge receipt immediately
      res.status(200).send('EVENT_RECEIVED');

      // Process async
      await this.processWebhook(req.body);

    } catch (error) {
      console.error('Webhook error:', error);
    }
  };

  private async processWebhook(body: any) {
    if (body.object !== 'whatsapp_business_account') {
      console.log('Invalid webhook object:', body.object);
      return;
    }

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === 'messages') {
          await this.handleIncomingMessage(change.value);
        } else if (change.field === 'message_template_status_update') {
          await this.handleTemplateStatusUpdate(change.value);
        } else {
          console.log('Unhandled webhook field:', change.field);
        }
      }
    }
  }

  handleTemplateStatusUpdate(value: any) {
    throw new Error('Method not implemented.');
  }

  private async handleIncomingMessage(value: any) {
    const message = value.messages?.[0];
    if (!message) return;

    const { from, type, id: messageId, timestamp } = message;
    console.log(`📱 New ${type} message from ${from}`);

    // Check if it's an order from catalog
    if (type === 'order') {
      await this.handleOrder(value);
      return;
    }

    // Handle different message types
    const processedMessage = await this.processMessage(message, value);

    // Notify Socket.IO
    try {
      const socketManager = getSocketManager();
      socketManager.notifyNewMessage(from, {
        id: messageId,
        sender: 'customer',
        text: processedMessage.content,
        time: new Date(parseInt(timestamp) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isBot: false,
        messageType: type,
        metadata: processedMessage.metadata
      });
    } catch (error) {
      console.log('Socket manager not ready yet:', error);
    }

    // Auto-reply for text messages
    if (type === 'text') {
      await this.handleTextAutoReply(from, processedMessage.content);
    }
  }

  private async handleOrder(value: any) {
    try {
      const message = value.messages?.[0];
      const customerPhone = message.from;
      const order = message.order;
      const catalogId = order.catalog_id;
      const orderId = order.id;

      console.log(`🛒 Order received from ${customerPhone}`, { orderId, catalogId });

      // Extract order items
      const items = order.product_items?.map((item: any) => ({
        productId: item.product_retailer_id,
        productName: item.product_retailer_id, // Fetch actual name from DB
        quantity: item.quantity,
        price: parseFloat(item.item_price) || 0,
        currency: item.currency || 'NGN'
      })) || [];
      if (items.length === 0) {
        console.log('Order received with no items');
        return;
      }

      // Check stock availability and get merchantId
      let merchantId = '';

      for (const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          await whatsappService.sendMessage(
            customerPhone,
            `❌ Sorry, product not found. Please try again or contact support.`
          );
          return;
        }

        if (!merchantId) {
          merchantId = product.merchantId;
        }

        if (product.stockQuantity < item.quantity) {
          await whatsappService.sendMessage(
            customerPhone,
            `❌ Insufficient stock for ${product.name}.

          Available: ${product.stockQuantity} units
          Requested: ${item.quantity} units

          Please reduce your order quantity and try again.`
          );
          return;
        }
      }

      // Check if customer has existing pending order
      const existingPendingOrder = await prisma.customerOrder.findFirst({
        where: {
          customerPhone,
          paymentStatus: 'PENDING',
        },
      });

      if (existingPendingOrder) {
        await whatsappService.sendMessage(
          customerPhone,
          `⚠️ You already have a pending order (${existingPendingOrder.orderNumber}).
        
        Please complete payment for that order first before placing a new one.`
        );
        return;
      }

      // Calculate total
      const totalAmount = items.reduce((sum: number, item: any) =>
        sum + (item.price * item.quantity), 0
      );

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
        paymentReference,
        merchantId
      );

      // Initialize Paystack payment
      const payment = await this.paystackService.initializePayment(
        customerEmail,
        totalAmount,
        paymentReference,
        createdOrder.id
      );

      console.log('Order created:', { customerPhone, totalAmount });

      // Ask for email
      const emailRequestMessage = `
      ✅ Order Received! 
      Order Number: ${createdOrder.orderNumber}
      Total Amount: ₦${totalAmount.toLocaleString()}

      📧 Please reply with your email address to receive your receipt and invoice.

      Or type SKIP if you don't want to provide an email.
    `.trim();

      await whatsappService.sendMessage(customerPhone, emailRequestMessage);
    } catch (error) {
      console.error('Error handling order:', error);
    }
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

  // Placeholder methods for missing implementations to avoid compilation errors
  private async processMessage(message: any, value: any): Promise<any> {
    console.warn('processMessage not implemented');
    const text = message.text?.body || '';
    return { content: text };
  }

  private async handleTextAutoReply(from: string, content: string) {
    // console.log('Auto-reply not implemented');
  }
}