import { Server as SocketServer, Socket } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import { whatsappService } from '../services/whatsapp.service';

// Create separate Express app for Socket.IO
const socketApp = express();
const httpServer = createServer(socketApp);

// Store connections
const adminSockets = new Map<string, Socket>();
const customerConversations = new Map<string, any[]>();

class SocketManager {
  public io: SocketServer;

  constructor(server?: any) {
    // Use provided server or create new one
    const httpServerToUse = server || httpServer;
    
    this.io = new SocketServer(httpServerToUse, {
      cors: {
        origin: process.env.APP_URL || 'http://localhost:5000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.initialize();
    console.log('✅ Socket.IO server initialized');
  }

  private initialize() {
    this.io.on('connection', (socket: Socket) => {
      console.log('🔌 New admin connected:', socket.id);
      adminSockets.set(socket.id, socket);
      socket.join('admins');

      socket.emit('connected', {
        socketId: socket.id,
        message: 'Connected to WhatsApp dashboard',
        timestamp: new Date().toISOString()
      });

      // Admin sends message to customer
      socket.on('admin:send_message', async (data: { customerPhone: string; message: string }) => {
        await this.handleAdminMessage(socket, data);
      });

      // Admin requests conversation
      socket.on('admin:get_conversation', (data: { customerPhone: string }) => {
        const conversation = customerConversations.get(data.customerPhone) || [];
        socket.emit('admin:conversation_history', {
          customerPhone: data.customerPhone,
          messages: conversation
        });
      });

      // Admin joins customer room
      socket.on('admin:join_customer', (data: { customerPhone: string }) => {
        socket.join(`customer:${data.customerPhone}`);
      });

      // Admin leaves customer room
      socket.on('admin:leave_customer', (data: { customerPhone: string }) => {
        socket.leave(`customer:${data.customerPhone}`);
      });

      // Broadcast
      socket.on('admin:broadcast', async (data: { customerPhones: string[]; message: string }) => {
        await this.handleBroadcast(socket, data);
      });

      // Disconnect
      socket.on('disconnect', () => {
        console.log('🔌 Admin disconnected:', socket.id);
        adminSockets.delete(socket.id);
        socket.broadcast.to('admins').emit('admin:disconnected', {
          socketId: socket.id
        });
      });
    });
  }

  private async handleAdminMessage(socket: Socket, data: { customerPhone: string; message: string }) {
    try {
      const result = await whatsappService.sendText(data.customerPhone, data.message);
      
      this.io.to('admins').emit('admin:message_sent', {
        customerPhone: data.customerPhone,
        message: data.message,
        messageId: result.messages[0]?.id,
        adminId: socket.id
      });

      this.addToConversation(data.customerPhone, {
        type: 'outgoing',
        message: data.message,
        sender: 'admin',
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      socket.emit('admin:message_error', {
        customerPhone: data.customerPhone,
        error: error.message
      });
    }
  }

  private async handleBroadcast(socket: Socket, data: { customerPhones: string[]; message: string }) {
    const results = [];
    const errors = [];
    
    for (const phone of data.customerPhones) {
      try {
        const result = await whatsappService.sendText(phone, data.message);
        results.push({ phone, success: true });
      } catch (error: any) {
        errors.push({ phone, error: error.message });
      }
    }
    
    socket.emit('admin:broadcast_result', {
      sent: results.length,
      failed: errors.length
    });
  }

    notifyMessageStatusUpdate(messageId: string, status: string) {
    if (this.io) {
      this.io.emit('message-status-update', {
        messageId,
        status,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Public methods for use in webhook
  public notifyNewMessage(customerPhone: string, message: any) {
    this.addToConversation(customerPhone, {
      type: 'incoming',
      message: message.text?.body || '[Media message]',
      sender: 'customer',
      timestamp: new Date().toISOString()
    });

    this.io.to('admins').emit('customer:new_message', {
      customerPhone,
      message: message.text?.body || '[Media message]',
      timestamp: new Date().toISOString()
    });
  }

  private addToConversation(customerPhone: string, message: any) {
    if (!customerConversations.has(customerPhone)) {
      customerConversations.set(customerPhone, []);
    }
    customerConversations.get(customerPhone)!.push(message);
  }

  public getOnlineAdmins(): number {
    return adminSockets.size;
  }
}

// Export singleton
let socketManager: SocketManager;

export function initializeSocket(server?: any): SocketManager {
  if (!socketManager) {
    socketManager = new SocketManager(server);
  }
  return socketManager;
}

export function getSocketManager(): SocketManager {
  if (!socketManager) {
    throw new Error('Socket manager not initialized');
  }
  return socketManager;
}