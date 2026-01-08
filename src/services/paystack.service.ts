import axios from 'axios';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

export class PaystackService {
  async initializePayment(email: string, amount: number, reference: string, p0: string) {
    try {
      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          email,
          amount: amount * 100, // Convert to kobo
          reference,
          callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.data;
    } catch (error: any) {
      console.error('Paystack error:', error.response?.data);
      throw error;
    }
  }

  async verifyPayment(reference: string) {
    try {
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      return response.data.data;
    } catch (error: any) {
      console.error('Verify payment error:', error.response?.data);
      throw error;
    }
  }

  async refundPayment(reference: string, amount?: number) {
    try {
      const response = await axios.post(
        'https://api.paystack.co/refund',
        {
          transaction: reference,
          amount: amount ? amount * 100 : undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.data;
    } catch (error: any) {
      console.error('Paystack refund error:', error.response?.data);
      throw error;
    }
  }
}