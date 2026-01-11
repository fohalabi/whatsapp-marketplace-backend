import prisma from '../config/database';
import { getIO } from '../config/socket';
import { CustomerOrderStatus } from '@prisma/client';

export class OrderManagementService {
  // Admin: Get all orders with filters
  async getAllOrders(filters: {
    status?: string;
    paymentStatus?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, paymentStatus, search, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status && status !== 'All') {
      where.status = status;
    }

    if (paymentStatus && paymentStatus !== 'All') {
      where.paymentStatus = paymentStatus;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.customerOrder.findMany({
        where,
        include: {
          items: {
            include: {
              product: true
            }
          },
          merchant: {
            select: {
              id: true,
              businessName: true
            }
          },
          delivery: {
            select: {
              id: true,
              deliveryNumber: true,
              status: true,
              rider: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.customerOrder.count({ where })
    ]);

    return {
      orders,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
  }

  // Merchant: Get orders for specific merchant
  async getMerchantOrders(merchantId: string, filters: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { merchantId };

    if (status && status !== 'All') {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.customerOrder.findMany({
        where,
        include: {
          items: {
            include: {
              product: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.customerOrder.count({ where })
    ]);

    return {
      orders,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
  }

  // Get single order by ID
  async getOrderById(orderId: string) {
    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true
          }
        },
        merchant: true,
        delivery: {
          include: {
            rider: true
          }
        }
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  }

  // Update order status (Admin)
  async updateOrderStatus(orderId: string, status: CustomerOrderStatus, userId: string) {
    const order = await prisma.customerOrder.update({
      where: { id: orderId },
      data: { status }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'order_status_updated',
        description: `Order ${order.orderNumber} status changed to ${status}`
      }
    });

    // Emit socket event
    try {
      const io = getIO();
      io.emit('order-status-updated', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status
      });
    } catch (error) {
      console.error('Socket emit error:', error);
    }

    return order;
  }

  // Update order status (Merchant - limited actions)
  async updateMerchantOrderStatus(
    orderId: string, 
    merchantId: string, 
    status: 'PROCESSING' | 'SHIPPED'
  ) {
    // Verify order belongs to merchant
    const order = await prisma.customerOrder.findFirst({
      where: {
        id: orderId,
        merchantId
      }
    });

    if (!order) {
      throw new Error('Order not found or access denied');
    }

    // Merchant can only move from PENDING -> PROCESSING -> READY
    const allowedTransitions: Record<string, string[]> = {
      'PENDING': ['PROCESSING'],
      'PROCESSING': ['SHIPPED']
    };

    if (!allowedTransitions[order.status]?.includes(status)) {
      throw new Error(`Cannot transition from ${order.status} to ${status}`);
    }

    const updated = await prisma.customerOrder.update({
      where: { id: orderId },
      data: { status }
    });

    // Emit socket event
    try {
      const io = getIO();
      io.emit('order-status-updated', {
        orderId: updated.id,
        orderNumber: updated.orderNumber,
        status
      });
    } catch (error) {
      console.error('Socket emit error:', error);
    }

    return updated;
  }

  // Assign courier (Admin only)
  async assignCourier(orderId: string, courierName: string, userId: string) {
    const order = await prisma.customerOrder.update({
      where: { id: orderId },
      data: {
        // Store courier info in metadata or create delivery record
        metadata: {
          courierName
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'courier_assigned',
        description: `Courier ${courierName} assigned to order ${order.orderNumber}`
      }
    });

    return order;
  }

  // Cancel order
  async cancelOrder(orderId: string, userId: string) {
    const order = await this.getOrderById(orderId);

    // Restore stock if order was paid
    if (order.paymentStatus === 'PAID') {
      for (const item of order.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { increment: item.quantity }
          }
        });
      }
    }

    const updated = await prisma.customerOrder.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'order_cancelled',
        description: `Order ${order.orderNumber} cancelled`
      }
    });

    return updated;
  }

  // Get order statistics
  async getOrderStats() {
    const [
      total,
      processing,
      readyForPickup,
      inDelivery,
      awaitingPayment
    ] = await Promise.all([
      prisma.customerOrder.count(),
      prisma.customerOrder.count({ where: { status: 'PROCESSING' } }),
      prisma.customerOrder.count({ where: { status: 'SHIPPED' } }),
      prisma.customerOrder.count({ where: { status: 'DELIVERED' } }),
      prisma.customerOrder.count({ where: { paymentStatus: 'PENDING' } })
    ]);

    return {
      total,
      processing,
      readyForPickup,
      inDelivery,
      awaitingPayment
    };
  }
}