import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// serve uploadd files
app.use('/uploads', express.static('uploads'));

app.use('api/whatsapp', whatsappWebhookRoutes);

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

app.use('/api/test', testRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});