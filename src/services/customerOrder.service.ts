import prisma from '../config/database';

export class OrderService {
  async createOrder(
    customerPhone: string, 
    customerEmail: string,
    items: any[], 
    totalAmount: number,
    paymentReference: string
  ) {
    const order = await prisma.customerOrder.create({
      data: {
        customerPhone,
        customerEmail,
        totalAmount,
        paymentReference,
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
}