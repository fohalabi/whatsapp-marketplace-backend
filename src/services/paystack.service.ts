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

  async initiateTransfer(
    amount: number,
    accountNumber: string,
    bankCode: string,
    accountName: string,
    reference: string,
    reason: string = 'Merchant withdrawal'
  ) {
    try {
      const response = await axios.post(
        'https://api.paystack.co/transfer',
        {
          source: 'balance',
          amount: amount * 100, // Convert to kobo
          recipient: accountNumber,
          reason,
          reference,
          currency: 'NGN',
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
      console.error('Paystack transfer error:', error.response?.data);
      throw error;
    }
  }

  async createTransferRecipient(
    accountNumber: string,
    bankCode: string,
    accountName: string
  ) {
    try {
      const response = await axios.post(
        'https://api.paystack.co/transferrecipient',
        {
          type: 'nuban',
          name: accountName,
          account_number: accountNumber,
          bank_code: bankCode,
          currency: 'NGN',
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
      console.error('Create recipient error:', error.response?.data);
      throw error;
    }
  }

  async getBanks() {
    try {
      const response = await axios.get(
        'https://api.paystack.co/bank?currency=NGN',
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      return response.data.data;
    } catch (error: any) {
      console.error('Get banks error:', error.response?.data);
      throw error;
    }
  }

  async verifyAccountNumber(accountNumber: string, bankCode: string) {
    try {
      const response = await axios.get(
        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      return response.data.data; // Returns {account_number, account_name, bank_id}
    } catch (error: any) {
      console.error('Account verification error:', error.response?.data);
      throw error;
    }
  }

  async getBankCodeByName(bankName: string): Promise<string> {
    const banks = await this.getBanks();
    
    const bank = banks.find((b: any) => 
      b.name.toLowerCase().includes(bankName.toLowerCase()) ||
      bankName.toLowerCase().includes(b.name.toLowerCase())
    );

    if (!bank) {
      throw new Error(`Bank not found: ${bankName}`);
    }

    return bank.code;
  }
}