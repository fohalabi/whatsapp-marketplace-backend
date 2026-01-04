import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
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

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.io
initializeSocket(server);

app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

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
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/admin/team', teamManagementRoutes);
app.use('/api/admin/refunds', refundRoutes);
app.use('/api/admin/abandoned-orders', abandonedOrderRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('api/reports', reportRoutes);

app.use('/api/test', testRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startPaymentTimeoutJob();
});