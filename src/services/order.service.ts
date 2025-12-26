import prisma from '../config/database';
import { CreateOrderDTO, UpdateOrderStatusDTO } from '../types/order.types';

export class OrderService {
  async createOrder(data: CreateOrderDTO) {
    const order = await prisma.order.create({
      data: {
        merchantId: data.merchantId,
        totalAmount: data.totalAmount,
        pickupTime: data.pickupTime,
        orderNotes: data.orderNotes ?? null,
        orderItems: {
          create: data.orderItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return order;
  }

  async getMerchantOrders(merchantId: string) {
    const orders = await prisma.order.findMany({
      where: { merchantId },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders;
  }

  async getOrderById(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  }

  async updateOrderStatus(orderId: string, merchantId: string, data: UpdateOrderStatusDTO) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.merchantId !== merchantId) {
      throw new Error('Unauthorized to update this order');
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: data.status,
        rejectionReason: data.rejectionReason ?? null,
      },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return updatedOrder;
  }
}