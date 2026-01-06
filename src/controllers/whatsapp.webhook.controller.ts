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

  // ========== WEBHOOK VERIFICATION ==========

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

  // ========== WEBHOOK RECEIVING ==========

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

  // ========== WEBHOOK PROCESSING ==========

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

  // ========== INCOMING MESSAGE HANDLING ==========

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

  // ========== ORDER PROCESSING ==========

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

      // Calculate total
      const totalAmount = items.reduce((sum: number, item: any) => 
        sum + (item.price * item.quantity), 0
      );

      // Generate payment reference
      const paymentReference = `ORDER_${Date.now()}`;
      
      // Customer email
      const customerEmail = `${customerPhone.replace('+', '')}@customer.com`;

      // Create order in database
      const createdOrder = await this.orderService.createOrder(
        customerPhone, 
        customerEmail,
        items, 
        totalAmount,
        paymentReference,
        'whatsapp'
      );

      // Initialize Paystack payment
      const payment = await this.paystackService.initializePayment(
        customerEmail,
        totalAmount,
        paymentReference,
        'Order #' + createdOrder.orderNumber
      );

      // Save order message to chat
      await whatsappService.saveIncomingMessage({
        customerPhone,
        content: `🛒 New order placed: ${createdOrder.orderNumber}\nTotal: ₦${totalAmount.toLocaleString()}`,
        messageType: 'order',
        whatsappMessageId: message.id,
        metadata: {
          orderId,
          catalogId,
          items,
          totalAmount,
          paymentReference,
          orderNumber: createdOrder.orderNumber
        }
      });

      // Send payment link
      const paymentMessage = `
✅ Order Received! 
Order Number: ${createdOrder.orderNumber}
Total Amount: ₦${totalAmount.toLocaleString()}

Click here to pay: ${payment.authorization_url}

Payment options: Card, Bank Transfer, USSD
      `.trim();

      await whatsappService.sendText(customerPhone, paymentMessage);

      console.log(`✅ Order processed: ${createdOrder.orderNumber}`);

    } catch (error: any) {
      console.error('Error handling order:', error);
      
      // Try to notify customer of error
      try {
        const customerPhone = value.messages?.[0]?.from;
        if (customerPhone) {
          await whatsappService.sendText(
            customerPhone,
            '❌ We encountered an error processing your order. Please try again or contact support.'
          );
        }
      } catch (sendError) {
        console.error('Failed to send error message:', sendError);
      }
    }
  }

  // ========== MESSAGE PROCESSING ==========

  private async processMessage(message: any, value: any) {
    const { from, type, id: messageId, timestamp } = message;
    
    let content = '';
    let metadata: any = {};

    // Extract content based on message type
    switch (type) {
      case 'text':
        content = message.text?.body || '';
        metadata = { text: content };
        break;
      case 'image':
        content = '📷 Image message';
        metadata = {
          imageId: message.image?.id,
          caption: message.image?.caption,
          mimeType: message.image?.mime_type,
          sha256: message.image?.sha256
        };
        break;
      case 'document':
        content = '📄 Document message';
        metadata = {
          filename: message.document?.filename,
          mimeType: message.document?.mime_type,
          sha256: message.document?.sha256,
          caption: message.document?.caption
        };
        break;
      case 'audio':
        content = '🎤 Audio message';
        metadata = {
          audioId: message.audio?.id,
          mimeType: message.audio?.mime_type
        };
        break;
      case 'video':
        content = '🎬 Video message';
        metadata = {
          videoId: message.video?.id,
          caption: message.video?.caption,
          mimeType: message.video?.mime_type
        };
        break;
      case 'sticker':
        content = '😀 Sticker';
        metadata = {
          stickerId: message.sticker?.id
        };
        break;
      case 'interactive':
        content = this.handleInteractiveMessage(message);
        metadata = {
          interactiveType: message.interactive?.type,
          buttonReply: message.interactive?.button_reply,
          listReply: message.interactive?.list_reply
        };
        break;
      case 'location':
        content = '📍 Location message';
        metadata = {
          latitude: message.location?.latitude,
          longitude: message.location?.longitude,
          name: message.location?.name,
          address: message.location?.address
        };
        break;
      case 'contacts':
        content = '👥 Contact message';
        metadata = {
          contacts: message.contacts
        };
        break;
      default:
        content = `[${type} message]`;
        metadata = { rawMessage: message };
        console.log('Unhandled message type:', type, message);
    }

    // Save to encrypted chat
    await whatsappService.saveIncomingMessage({
      customerPhone: from,
      content,
      messageType: type,
      whatsappMessageId: messageId,
      metadata: {
        ...metadata,
        timestamp: new Date(parseInt(timestamp) * 1000),
        context: message.context
      }
    });

    // Save to admin chat (legacy)
    await prisma.customerMessage.create({
      data: {
        messageId: messageId,
        from,
        message: content.substring(0, 500),
        metadata: metadata
      }
    });

    return { content, metadata };
  }

  // ========== TEMPLATE STATUS UPDATES ==========

  private async handleTemplateStatusUpdate(value: any) {
    const statusUpdate = value.message_template_status_update;
    const messageId = statusUpdate.message_id;
    const status = statusUpdate.status;
    const timestamp = statusUpdate.timestamp;

    console.log(`📊 Template status update: ${messageId} - ${status}`);

    // Update message status in database
    await prisma.message.updateMany({
      where: { whatsappMessageId: messageId },
      data: { 
        status: status.toLowerCase(),
        metadata: {
          update: {
            status,
            timestamp: new Date(parseInt(timestamp) * 1000),
            conversationId: statusUpdate.recipient_id
          }
        }
      }
    });

    // Notify socket if needed
    if (status === 'read' || status === 'delivered') {
      try {
        const socketManager = getSocketManager();
        socketManager.notifyMessageStatusUpdate(messageId, status);
      } catch (error) {
        console.log('Socket notification failed:', error);
      }
    }
  }

  // ========== AUTO-REPLY LOGIC ==========

  private async handleTextAutoReply(from: string, text: string) {
    const lowerText = text.toLowerCase().trim();
    
    let reply = '';

    // Enhanced auto-reply logic
    if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('hey')) {
      reply = '👋 Hello! Welcome to Jasper\'s Market! How can I help you today?';
    } else if (lowerText.includes('product') || lowerText.includes('catalog') || lowerText.includes('items')) {
      reply = '📦 Browse our catalog by clicking the menu button or type "categories" to see product categories.';
    } else if (lowerText.includes('price') || lowerText.includes('cost')) {
      reply = '💰 Please check our catalog for prices. All items have competitive pricing!\n\nNeed a specific item price? Let me know which product.';
    } else if (lowerText.includes('delivery') || lowerText.includes('shipping')) {
      reply = '🚚 We offer delivery nationwide!\n• Lagos: 24-48 hours\n• Other cities: 3-5 days\n• Free shipping on orders above ₦10,000';
    } else if (lowerText.includes('order') || lowerText.includes('track')) {
      reply = '📦 To check your order status, please provide your order number.\n\nNew order? Browse our catalog and select items to order!';
    } else if (lowerText.includes('support') || lowerText.includes('help') || lowerText.includes('assistance')) {
      reply = '🆘 For support:\n• Call: 0800-JASPER (0800-527737)\n• Email: support@jaspersmarket.com\n• Hours: Mon-Fri 9AM-6PM\n\nHow can we assist you?';
    } else if (lowerText.includes('thanks') || lowerText.includes('thank you') || lowerText.includes('ty')) {
      reply = '😊 You\'re welcome! Let us know if you need anything else.';
    } else if (lowerText.includes('hours') || lowerText.includes('open') || lowerText.includes('close')) {
      reply = '🕒 Our store hours:\n• Monday-Friday: 9AM - 6PM\n• Saturday: 10AM - 4PM\n• Sunday: Closed';
    } else if (lowerText.includes('location') || lowerText.includes('address') || lowerText.includes('where')) {
      reply = '📍 Our address:\nJasper\'s Market HQ\n123 Market Street, Lagos\nNigeria\n\n📍 Google Maps: https://maps.app.goo.gl/example';
    } else if (lowerText.includes('return') || lowerText.includes('refund')) {
      reply = '🔄 Returns & Refunds:\n• 7-day return policy\n• Items must be unused and in original packaging\n• Contact support for returns at support@jaspersmarket.com';
    } else if (lowerText.includes('payment') || lowerText.includes('pay') || lowerText.includes('card')) {
      reply = '💳 Payment methods:\n• Card (Visa/Mastercard)\n• Bank Transfer\n• USSD\n• WhatsApp Pay (coming soon)\n\nAll payments are secured by Paystack.';
    } else if (lowerText.includes('menu') || lowerText.includes('options') || lowerText.includes('what can you do')) {
      reply = `📋 Here's what I can help with:

🛍️ *Shopping:*
• Type "catalog" to browse products
• Type "order" to place an order
• Type "track" to check order status

ℹ️ *Information:*
• Type "hours" for store hours
• Type "location" for our address
• Type "delivery" for shipping info

🆘 *Support:*
• Type "support" for assistance
• Type "return" for return policy
• Type "payment" for payment options

Just type what you need help with!`;
    } else {
      // Default reply for unmatched messages
      reply = `Thanks for your message! Our team will respond shortly.\n\nFor quick help, you can:\n• Type "menu" for options\n• Type "catalog" to browse products\n• Type "support" for assistance\n• Type "delivery" for shipping info\n\nOr visit: https://jaspersmarket.com`;
    }

    try {
      await whatsappService.sendText(from, reply);
      
      // Also save the auto-reply as a bot message
      await whatsappService.saveIncomingMessage({
        customerPhone: from,
        content: reply,
        messageType: 'text',
        whatsappMessageId: `bot_${Date.now()}`,
        metadata: {
          isAutoReply: true,
          triggeredBy: text
        }
      });

    } catch (error: any) {
      console.error('Error sending auto-reply:', error);
    }
  }

  // ========== INTERACTIVE MESSAGE HANDLING ==========

  private handleInteractiveMessage(message: any): string {
    const interactive = message.interactive;
    if (!interactive) return '[Interactive message]';

    switch (interactive.type) {
      case 'button_reply':
        return `🔘 Selected: ${interactive.button_reply?.title || 'Button clicked'}`;
      case 'list_reply':
        return `📋 Selected: ${interactive.list_reply?.title || 'List option selected'}`;
      default:
        return `[${interactive.type} interaction]`;
    }
  }
}

// Export controller instance
export const whatsappWebhookController = new WhatsAppWebhookController();
export default whatsappWebhookController;