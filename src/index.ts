import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import testRoutes from './routes/test.routes';
import teamRoutes from './routes/team.routes';
import merchantRoutes from './routes/verification.routes';
import productRoutes from './routes/product.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// serve uploadd files
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/products', productRoutes);

app.use('/api/test', testRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});