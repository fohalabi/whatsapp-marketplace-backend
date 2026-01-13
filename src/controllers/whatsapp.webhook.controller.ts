import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import { whatsappService } from '../services/whatsapp.service';
import { getSocketManager } from '../middleware/socket.middleware';
import { OrderService } from '../services/customerOrder.service';
import { PaystackService } from '../services/paystack.service';
import { errorLogger, ErrorSeverity } from '../services/errorLogger.service';
import { getIO } from '../config/socket';
import { calculateDeliveryFee, getDeliveryFeeDescription } from '../utils/deliveryFee.utils';

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
      // Always verify signature if secret is configured
      if (process.env.WHATSAPP_WEBHOOK_SECRET) {
        const signature = req.headers['x-hub-signature-256'] as string;
        
        if (!signature) {
          console.error('❌ Missing webhook signature');
          await errorLogger.logError({
            service: 'WhatsAppWebhook',
            action: 'verifySignature',
            severity: ErrorSeverity.HIGH,
            error: new Error('Missing X-Hub-Signature-256 header'),
            context: { source: req.ip }
          });
          return res.sendStatus(403);
        }

        const expectedSignature = crypto
          .createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET)
          .update(JSON.stringify(req.body))
          .digest('hex');

        if (signature !== `sha256=${expectedSignature}`) {
          console.error('❌ Invalid webhook signature');
          await errorLogger.logError({
            service: 'WhatsAppWebhook',
            action: 'verifySignature',
            severity: ErrorSeverity.CRITICAL,
            error: new Error('Invalid webhook signature - possible attack'),
            context: { 
              source: req.ip,
              receivedSignature: signature.substring(0, 20) + '...'
            }
          });
          return res.sendStatus(403);
        }
      } else {
        console.warn('⚠️ WHATSAPP_WEBHOOK_SECRET not configured - webhooks unprotected!');
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

      const existingOrder = await prisma.customerOrder.findFirst({
        where: {
          customerPhone,
          paymentReference: `WA_${orderId}`
        }
      });

      if (existingOrder) {
        console.log('⚠️ Duplicate order detected:', orderId);
        await whatsappService.sendMessage(
          customerPhone,
          `This order has already been processed. Order Number: ${existingOrder.orderNumber}`
        );
        return;
      }

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

      // Reserve stock atomically during validation
      const stockReservations = [];

      for (const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          await whatsappService.sendMessage(
            customerPhone,
            `❌ Product not found. Please try again.`
          );
          return;
        }

        if (!merchantId) {
          merchantId = product.merchantId;
        }

        // Atomic stock check and temporary reservation
        const updated = await prisma.product.updateMany({
          where: {
            id: item.productId,
            stockQuantity: { gte: item.quantity } // Only update if stock sufficient
          },
          data: {
            stockQuantity: { decrement: item.quantity }
          }
        });

        if (updated.count === 0) {
          // Stock insufficient - rollback previous reservations
          for (const reservation of stockReservations) {
            await prisma.product.update({
              where: { id: reservation.productId },
              data: { stockQuantity: { increment: reservation.quantity } }
            });
          }

          await whatsappService.sendMessage(
            customerPhone,
            `❌ Insufficient stock for ${product.name}.
            
            Available: Check current stock
            Requested: ${item.quantity} units

            Please try again with a lower quantity.`
          );
          return;
        }

        stockReservations.push({ productId: item.productId, quantity: item.quantity });
      }
      
      const updatedProducts = await prisma.product.findMany({
        where: {
          id: { in: stockReservations.map(r => r.productId) }
        },
        select: {
          id: true,
          stockQuantity: true
        }
      });

      // Emit socket event
      try {
        const io = getIO();
        io.emit('stock-updated', {
          products: updatedProducts
        });
      } catch (error) {
        console.error('Socket emit error:', error);
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
      const subtotal = items.reduce((sum: number, item: any) =>
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
        subtotal,
        paymentReference,
        merchantId,
        orderId
      );
      
      console.log('Order created:', { customerPhone, subtotal });

      // Ask for email
      const emailRequestMessage = `
        ✅ Order Received! 
        Order Number: ${createdOrder.orderNumber}
        Total Amount: ₦${subtotal.toLocaleString()}

        📧 Please reply with your email address to receive your receipt and invoice.

        Or type SKIP if you don't want to provide an email.
      `.trim();

      const locationRequest = `
       📍 Delivery Location Required
        
        Order: ${createdOrder.orderNumber}
        Total: ₦${subtotal.toLocaleString()}
        
        Please share your delivery location:
        
        1️⃣ Tap the 📎 (attachment) icon
        2️⃣ Select "Location"
        3️⃣ Choose "Send your current location" or search for an address

        Or reply with your full delivery address.
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
    const from = message.from;
    const type = message.type;

    // Handle location type
    if (type == 'location') {
      await this.handleLocationMessage(message, from);
      return {
        content: `Location: ${message.location.latitude}, ${message.location.longitude}`,
        metadata: message.location
      };
    }

    // handle text (could be address)
    if (type === 'text') {
      const text = message.text?.body || '';

      // Check if customer has pending order awaiting location
      const pendingOrder = await prisma.customerOrder.findFirst({
        where: {
          customerPhone: from,
          status: 'PENDING',
          deliveryAddress: null
        },
        orderBy: { createdAt: 'desc' }
      });

      if (pendingOrder) {
        await this.handleAddressText(from, text, pendingOrder);
      }

      return { content: text };
    }
    return { content: '' };
  }

  private async handleTextAutoReply(from: string, content: string) {
    // console.log('Auto-reply not implemented');
  }

  private async handleLocationMessage(message: any, customerPhone: string) {
    const { latitude, longitude } = message.location;

    // Find pending order
    const order = await prisma.customerOrder.findFirst({
      where: {
        customerPhone,
        status: 'PENDING',
        deliveryAddress: null
      },
      orderBy: { createdAt: 'desc' },
      include: {
        merchant: true
      }
    });

    if (!order) {
      await whatsappService.sendMessage(
        customerPhone,
        '❌ No pending order found. Please place an order first'
      );
      return;
    }

    // Get merchant location
    if (!order.merchant.latitude || !order.merchant.longitude) {
      await whatsappService.sendMessage(
        customerPhone,
        '❌ Merchant location not set. Contact support.'
      );
      return;
    }

    // Calculate delivery fee
    const deliveryFee = calculateDeliveryFee(
      { latitude: order.merchant.latitude, longitude: order.merchant.longitude },
      { latitude, longitude }
    );

    const deliveryDescription = getDeliveryFeeDescription(
      { latitude: order.merchant.latitude, longitude: order.merchant.longitude },
      { latitude, longitude }
    );

    // Update order with location and delivery fee
    const updatedOrder = await prisma.customerOrder.update({
      where: { id: order.id },
      data: {
        deliveryAddress: `Lat: ${latitude}, Long: ${longitude}`,
        deliveryLatitude: latitude,
        deliveryLongitude: longitude,
        deliveryFee: deliveryFee,
        totalAmount: order.totalAmount + deliveryFee 
      }
    });

    // Send payment link
    await this.sendPaymentLink(updatedOrder, customerPhone, deliveryFee, deliveryDescription);
  }

  private async handleAddressText(customerPhone: string, address: string, order: any) {
    // Simple validation
    if (address.length < 10) {
      await whatsappService.sendMessage(
        customerPhone,
        '❌ Address too short. Please provide your complete delivery address.'
      );
      return;
    }

    // Get merchant with location
    const merchant = await prisma.merchant.findUnique({
      where: { id: order.merchantId }
    });

    if (!merchant || !merchant.latitude || !merchant.longitude) {
      await whatsappService.sendMessage(
        customerPhone,
        '❌ Merchant location not set. Please contact support.'
      );
      return;
    }
    // For text address, use fallback location (ideally geocode later)
    const fallbackLocation = { latitude: 6.5355, longitude: 3.3087 };
    
    // Calculate delivery fee
    const deliveryFee = calculateDeliveryFee(
      { latitude: merchant.latitude, longitude: merchant.longitude },
      fallbackLocation
    );

    const deliveryDescription = getDeliveryFeeDescription(
      { latitude: merchant.latitude, longitude: merchant.longitude },
      fallbackLocation
    );

    // Update order with address and delivery fee
    const updatedOrder = await prisma.customerOrder.update({
      where: { id: order.id },
      data: {
        deliveryAddress: address,
        deliveryLatitude: fallbackLocation.latitude,
        deliveryLongitude: fallbackLocation.longitude,
        deliveryFee: deliveryFee,
        totalAmount: order.totalAmount + deliveryFee
      }
    });

    // Send payment link
    await this.sendPaymentLink(updatedOrder, customerPhone, deliveryFee, deliveryDescription);
  }

  private async sendPaymentLink(order: any, customerPhone: string, deliveryFee: number, deliveryDescription: string) {
    const paystackService = new PaystackService();
    
    const payment = await paystackService.initializePayment(
      order.customerEmail,
      order.totalAmount, // Now includes delivery fee
      order.paymentReference,
      order.id
    );

    await whatsappService.sendMessage(
      customerPhone,
      `✅ Location Received!

      Order: ${order.orderNumber}
      Subtotal: ₦${(order.totalAmount - deliveryFee).toLocaleString()}
      Delivery Fee (${deliveryDescription}): ₦${deliveryFee.toLocaleString()}
      Total Amount: ₦${order.totalAmount.toLocaleString()}

      💳 Complete Payment:
      ${payment.authorization_url}

      Payment expires in 30 minutes.`
    );
  }
}