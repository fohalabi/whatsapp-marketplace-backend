const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const CATALOG_ID = process.env.WHATSAPP_CATALOG_ID!;

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  retailPrice: number | null;
  images: string[];
  stockQuantity: number;
}

export class WhatsAppService {
  async syncProductToCatalog(product: Product) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v22.0/${CATALOG_ID}/products`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            retailer_id: product.id,
            name: product.name,
            description: product.description,
            price: (product.retailPrice || product.price) * 100, // in kobo
            currency: 'NGN',
            image_url: product.images[0] || '',
            url: `https://yourstore.com/products/${product.id}`,
            availability: product.stockQuantity > 0 ? 'in stock' : 'out of stock',
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to sync product');
      }

      return data.id; // WhatsApp product ID
    } catch (error: any) {
      console.error('WhatsApp sync error:', error);
      throw error;
    }
  }

  async sendMessage(to: string, message: string) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            text: { body: message },
          }),
        }
      );

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('WhatsApp message error:', error);
      throw error;
    }
  }
}