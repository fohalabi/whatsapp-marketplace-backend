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

  async createPendingOrder(
    customerPhone: string,
    items: any[],
    totalAmount: number
  ) {
    const order = await prisma.customerOrder.create({
      data: {
        customerPhone,
        customerEmail: '',
        totalAmount,
        paymentReference: `ORDER_${Date.now()}`,
        pendingEmailCollection: true,
        emailCollectionStatus: 'PENDING',
        paymentStatus: 'PENDING',
        status: 'PENDING',
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
}