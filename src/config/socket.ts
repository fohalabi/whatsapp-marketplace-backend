import { Server, Socket } from 'socket.io';
import express from 'express';
import { whatsappService } from '../services/whatsapp.service';

// Store active admin connections
const adminSockets = new Map<string, Socket>();

// Store customer conversations (in-memory for now, use Redis in production)
const customerConversations = new Map<string, any[]>();

export class SocketManager {
  private io: Server;

  constructor(httpServer: any) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.APP_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    console.log('✅ Socket.IO server initialized');
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log('🔌 New admin connected:', socket.id);
      
      // Store admin socket
      adminSockets.set(socket.id, socket);
      
      // Join admin room
      socket.join('admins');
      
      // Send connection confirmation
      socket.emit('connected', {
        socketId: socket.id,
        message: 'Connected to WhatsApp dashboard',
        timestamp: new Date().toISOString()
      });

      socket.on('admin:send_message', async (data: { customerPhone: string; message: string }) => {
        console.log(`💬 Admin ${socket.id} sending to ${data.customerPhone}: ${data.message}`);
        
        try {
          // Send via WhatsApp
          const result = await whatsappService.sendText(data.customerPhone, data.message);
          
          // Broadcast to all admins
          this.io.to('admins').emit('admin:message_sent', {
            customerPhone: data.customerPhone,
            message: data.message,
            messageId: result.messages[0]?.id,
            adminId: socket.id,
            timestamp: new Date().toISOString()
          });

          // Add to conversation history
          this.addToConversation(data.customerPhone, {
            type: 'outgoing',
            message: data.message,
            sender: 'admin',
            timestamp: new Date().toISOString(),
            messageId: result.messages[0]?.id
          });

        } catch (error: any) {
          socket.emit('admin:message_error', {
            customerPhone: data.customerPhone,
            error: error.message
          });
          console.error('❌ Admin send message error:', error);
        }
      });

      // Admin requests conversation history
      socket.on('admin:get_conversation', (data: { customerPhone: string }) => {
        const conversation = customerConversations.get(data.customerPhone) || [];
        socket.emit('admin:conversation_history', {
          customerPhone: data.customerPhone,
          messages: conversation
        });
      });

      // Admin joins specific customer room
      socket.on('admin:join_customer', (data: { customerPhone: string }) => {
        socket.join(`customer:${data.customerPhone}`);
        console.log(`Admin ${socket.id} joined customer: ${data.customerPhone}`);
      });

      // Admin leaves customer room
      socket.on('admin:leave_customer', (data: { customerPhone: string }) => {
        socket.leave(`customer:${data.customerPhone}`);
      });

      // Admin sends broadcast to multiple customers
      socket.on('admin:broadcast', async (data: { 
        customerPhones: string[]; 
        message: string;
        templateName?: string;
      }) => {
        console.log(`📢 Admin ${socket.id} broadcasting to ${data.customerPhones.length} customers`);
        
        const results = [];
        const errors = [];
        
        for (const phone of data.customerPhones) {
          try {
            let result;
            if (data.templateName) {
              result = await whatsappService.sendTemplate(phone, data.templateName);
            } else {
              result = await whatsappService.sendText(phone, data.message);
            }
            
            results.push({ phone, success: true, messageId: result.messages[0]?.id });
          } catch (error: any) {
            errors.push({ phone, error: error.message });
          }
        }
        
        socket.emit('admin:broadcast_result', {
          sent: results.length,
          failed: errors.length,
          results,
          errors
        });
      });

      // Admin marks conversation as resolved
      socket.on('admin:resolve_conversation', (data: { customerPhone: string }) => {
        this.io.to(`customer:${data.customerPhone}`).emit('conversation:resolved', {
          customerPhone: data.customerPhone,
          resolvedBy: socket.id,
          timestamp: new Date().toISOString()
        });
      });

      // ========== DISCONNECTION ==========
      socket.on('disconnect', () => {
        console.log('🔌 Admin disconnected:', socket.id);
        adminSockets.delete(socket.id);
        
        // Notify other admins
        socket.broadcast.to('admins').emit('admin:disconnected', {
          socketId: socket.id,
          timestamp: new Date().toISOString()
        });
      });

      socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    });
  }

  public notifyNewMessage(customerPhone: string, message: any) {
    // Add to conversation history
    this.addToConversation(customerPhone, {
      type: 'incoming',
      message: message.text?.body || '[Media message]',
      sender: 'customer',
      customerPhone: customerPhone,
      timestamp: new Date().toISOString(),
      messageType: message.type
    });

    // Broadcast to all admins
    this.io.to('admins').emit('customer:new_message', {
      customerPhone,
      message: message.text?.body || '[Media message]',
      messageType: message.type,
      timestamp: new Date().toISOString()
    });

    // Also notify specific customer room
    this.io.to(`customer:${customerPhone}`).emit('customer:message_received', {
      customerPhone,
      message: message.text?.body || '[Media message]',
      timestamp: new Date().toISOString()
    });

    console.log(`📨 New message from ${customerPhone} broadcasted to admins`);
  }

  // Notify admins of message delivery status
  public notifyMessageStatus(messageId: string, status: string, customerPhone?: string) {
    this.io.to('admins').emit('message:status_update', {
      messageId,
      status,
      customerPhone,
      timestamp: new Date().toISOString()
    });
  }

  // Notify admins of new customer
  public notifyNewCustomer(customerPhone: string, customerData: any) {
    this.io.to('admins').emit('customer:new', {
      customerPhone,
      ...customerData,
      timestamp: new Date().toISOString()
    });
  }

  // Notify admins of order update
  public notifyOrderUpdate(customerPhone: string, order: any) {
    this.io.to('admins').emit('order:update', {
      customerPhone,
      order,
      timestamp: new Date().toISOString()
    });
  }

  // Get online admin count
  public getOnlineAdmins(): number {
    return adminSockets.size;
  }

  // Add message to conversation history
  private addToConversation(customerPhone: string, message: any) {
    if (!customerConversations.has(customerPhone)) {
      customerConversations.set(customerPhone, []);
    }
    
    const conversation = customerConversations.get(customerPhone)!;
    conversation.push(message);
    
    // Keep only last 100 messages per conversation
    if (conversation.length > 100) {
      conversation.splice(0, conversation.length - 100);
    }
  }

  // Get conversation history
  public getConversation(customerPhone: string): any[] {
    return customerConversations.get(customerPhone) || [];
  }
}

export let socketManager: SocketManager;

export function initializeSocket(httpServer: any) {
  socketManager = new SocketManager(httpServer);
  return socketManager;
}

export function getIO(): Server {
  if (!socketManager) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
  return socketManager['io'];
}