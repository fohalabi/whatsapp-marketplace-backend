import prisma from '../config/database';
import { getIO } from '../config/socket';
import { EscrowService } from './escrow.service';

export class OrderService {
  private escrowService: EscrowService;

  constructor() {
    this.escrowService = new EscrowService();
  }

  async createOrder(
    customerPhone: string, 
    customerEmail: string,
    items: any[], 
    totalAmount: number,
    paymentReference: string,
    merchantId: string
  ) {
    const orderNumber = await this.generateOrderNumber();

    const order = await prisma.customerOrder.create({
      data: {
        customerPhone,
        customerEmail,
        totalAmount,
        paymentReference,
        orderNumber,
        merchantId,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return order;
  }

  async updatePaymentStatus(reference: string, status: 'PAID' | 'FAILED') {
    return await prisma.customerOrder.update({
      where: { paymentReference: reference },
      data: { 
        paymentStatus: status,
        status: status === 'PAID' ? 'PROCESSING' : 'CANCELLED'
      },
    });
  }

  async getOrderByNumber(orderNumber: string) {
    return await prisma.customerOrder.findUnique({
      where: { orderNumber },
      include: {
        items: {
          include: { product: true },
        },
      },
    });
  }

  async getOrderByReference(reference: string) {
    return await prisma.customerOrder.findUnique({
      where: { paymentReference: reference },
      include: {
        items: {
          include: { product: true },
        },
      },
    });
  }

  async createPendingOrder(
    customerPhone: string,
    items: any[],
    totalAmount: number,
    merchantId: string
  ) {
    const paymentExpiresAt = new Date(Date.now() + 30 * 60 * 1000)
    const orderNumber = await this.generateOrderNumber();

    const order = await prisma.customerOrder.create({
      data: {
        orderNumber,
        customerPhone,
        customerEmail: '',
        totalAmount,
        merchantId,
        paymentReference: `ORDER_${Date.now()}`,
        pendingEmailCollection: true,
        emailCollectionStatus: 'PENDING',
        paymentStatus: 'PENDING',
        status: 'PENDING',
        paymentExpiresAt,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return order;
  }

  async updateEmailAndProceed(orderNumber: string, email: string, skipped: boolean) {
    return await prisma.customerOrder.update({
      where: { orderNumber },
      data: {
        customerEmail: skipped ? `noreply-${Date.now()}@yourdomain.com` : email,
        pendingEmailCollection: false,
        emailCollectionStatus: skipped ? 'SKIPPED' : 'COLLECTED',
      },
    });
  }

  async getPendingEmailOrder(customerPhone: string) {
    return await prisma.customerOrder.findFirst({
      where: {
        customerPhone,
        pendingEmailCollection: true,
      },
      include: {
        items: {
          include: { product: true },
        },
      },
    });
  }

  async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const prefix = `ORD-${year}${month}${day}`;

    // Count orders today
    const count = await prisma.customerOrder.count({
      where: {
        orderNumber: {
          startsWith: prefix,
        },
      },
    });

    const nextNumber = (count + 1).toString().padStart(4, '0');
    return `${prefix}-${nextNumber}`;
  }

  async reduceStock(orderId: string) {
    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) return;

    const updatedProducts = [];

    // Reduce stock for each item
    for (const item of order.items) {
      const updatedProduct = await prisma.product.update({
        where: { id: item.productId },
        data: {
          stockQuantity: {
            decrement: item.quantity,
          },
        },
      });
      
      updatedProducts.push(updatedProduct);
    }

    // Emit socket event to all connected clients
    try {
      const io = getIO();
      io.emit('stock-updated', {
        products: updatedProducts.map(p => ({
          id: p.id,
          stockQuantity: p.stockQuantity,
        })),
      });
      console.log('Stock update emitted via WebSocket');
    } catch (error) {
      console.error('Socket emit error:', error);
    }

    console.log('Stock reduced for order:', order.orderNumber);
  }

  async updateOrderStatus(orderId: string, status: any) {
    const order = await prisma.customerOrder.update({
      where: { id: orderId },
      data: { status },
    });

    // If order delivered, release escrow
    if (status === 'DELIVERED') {
      await this.escrowService.releaseEscrowToPayout(orderId);
      console.log('Order delivered, escrow released:', orderId);
    }

    return order;
  }
}