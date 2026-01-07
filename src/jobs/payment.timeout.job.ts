import cron from 'node-cron';
import { PaymentTimeoutService } from '../services/payment.timeout.service';

const paymentTimeoutService = new PaymentTimeoutService();

// Run every 5 minutes
export const startPaymentTimeoutJob = () => {
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running payment timeout check...');
    await paymentTimeoutService.cancelExpiredOrders();
  });

  console.log('Payment timeout job started (runs every 5 minutes)');
};