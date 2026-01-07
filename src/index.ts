// import express from 'express';
// import cors from 'cors';
// import dotenv from 'dotenv';
// import authRoutes from './routes/auth.routes';
// import testRoutes from './routes/test.routes';
// import teamRoutes from './routes/team.routes';
// import merchantRoutes from './routes/verification.routes';
// import productRoutes from './routes/product.routes';
// import orderRoutes from './routes/order.routes';
// import dashboardController from './routes/merchantdashboard.routes';
// import adminProfileRoutes from './routes/adminProfile.routes';
// import adminMerchantRoutes from './routes/adminMerchant.routes';
// import adminProductRoute from './routes/admin.products.routes';
// import whatsappRoutes from './routes/whatsapp.routes';
// import teamManagementRoutes from './routes/teamManagement.routes';
// import whatsappWebhookRoutes from './routes/whatsapp.webhook.routes';

// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 5000;

// app.use(cors());
// app.use(express.json());

// // serve uploadd files
// app.use('/uploads', express.static('uploads'));

// app.use('api/whatsapp', whatsappWebhookRoutes);

// app.use('/api/auth', authRoutes);
// app.use('/api/team', teamRoutes);
// app.use('/api/merchant', merchantRoutes);
// app.use('/api/merchant/products', productRoutes);
// app.use('/api/orders', orderRoutes);
// app.use('/api/merchantdashboard', dashboardController);
// app.use('/api/admin/profile', adminProfileRoutes);
// app.use('/api/admin/merchants', adminMerchantRoutes);
// app.use('/api/admin/products', adminProductRoute);
// app.use('/api/whatsapp', whatsappRoutes);
// app.use('/api/admin/team', teamManagementRoutes);

// app.use('/api/test', testRoutes);

// app.get('/health', (req, res) => {
//     res.json({ status: 'ok' });
// });

// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });

import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initializeSocket } from './config/socket';
import { startPaymentTimeoutJob } from './jobs/payment.timeout.job';
import authRoutes from './routes/auth.routes';
import testRoutes from './routes/test.routes';
import teamRoutes from './routes/team.routes';
import merchantRoutes from './routes/verification.routes';
import productRoutes from './routes/product.routes';
import orderRoutes from './routes/order.routes';
import dashboardController from './routes/merchantdashboard.routes';
import adminProfileRoutes from './routes/adminProfile.routes';
import adminMerchantRoutes from './routes/adminMerchant.routes';
import adminProductRoute from './routes/admin.products.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import teamManagementRoutes from './routes/teamManagement.routes';
import whatsappWebhookRoutes from './routes/whatsapp.webhook.routes';
import paystackWebhookRoutes from './routes/paystack.webhook.routes';
import refundRoutes from './routes/refund.routes';
import abandonedOrderRoutes from './routes/abandonedOrder.routes';
import escrowRoutes from './routes/escrow.routes';
import payoutRoutes from './routes/payout.routes';
import reportRoutes from './routes/report.routes';
import broadcastRoutes from './routes/broadcast.routes';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.io
initializeSocket(server);

// Create HTTP server for Socket.IO
const httpServer = createServer(app);

// Initialize Socket.IO with custom SocketManager
const socketManager = initializeSocket(httpServer);

const allowedOrigins = [
  'http://localhost:3000',  // Your frontend
  'http://localhost:3001',  // Alternative port
].filter(Boolean);

// CORS configuration for both Express and Socket.IO
const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Routes - MAKE SURE ALL ROUTES START WITH A LEADING SLASH
app.use('/api/whatsapp-webhook', whatsappWebhookRoutes); // Fixed: added leading slash and specific path
// Routes
app.use('/api/paystack', paystackWebhookRoutes);
app.use('/api/whatsapp', whatsappWebhookRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/merchant/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/merchantdashboard', dashboardController);
app.use('/api/admin/profile', adminProfileRoutes);
app.use('/api/admin/merchants', adminMerchantRoutes);
app.use('/api/admin/products', adminProductRoute);
app.use('/api/whatsapp', whatsappRoutes); // Regular WhatsApp routes
app.use('/api/admin/team', teamManagementRoutes);
app.use('/api/admin/broadcast', broadcastRoutes);
app.use('/api/admin/refunds', refundRoutes);
app.use('/api/admin/abandoned-orders', abandonedOrderRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('api/reports', reportRoutes);

app.use('/api/test', testRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    onlineAdmins: socketManager.getOnlineAdmins(),
    timestamp: new Date().toISOString()
  });
});

// Socket.IO status endpoint
app.get('/api/socket/status', (req, res) => {
  res.json({
    connected: true,
    onlineAdmins: socketManager.getOnlineAdmins(),
    serverTime: new Date().toISOString()
  });
});

// Add WebSocket server status endpoint
app.get('/api/websocket/info', (req, res) => {
  const io = (socketManager as any).io;
  res.json({
    serverId: io?.engine?.generateId?.() || 'unknown',
    connectedSockets: io?.engine?.clientsCount || 0,
    serverUrl: process.env.APP_URL || 'http://localhost:3001',
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 5000
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// // 404 handler - FIXED: Make sure it's last and doesn't have wildcard issues
// app.use('*', (req, res) => {
//   res.status(404).json({ 
//     error: 'Route not found',
//     path: req.originalUrl,
//     method: req.method 
//   });
// });

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 WebSocket server initialized`);
  console.log(`🌐 App URL: ${process.env.APP_URL || 'http://localhost:3001'}`);
  console.log(`📡 Socket.IO endpoint: ws://localhost:${PORT}`);
});

// Handle server shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
