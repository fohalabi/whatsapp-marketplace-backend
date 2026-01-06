import prisma from '../../config/database';
import { WhatsAppService } from '../whatsapp.service';
import { getIO } from '../../config/socket';
import { DeliveryStatus } from '@prisma/client';

const whatsappService = new WhatsAppService();

export class DeliveryOrchestrator {
  async createDelivery(orderId: string) {
    const order = await prisma.customerOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: true },
        },
        merchant: true,
      },
    });

    if (!order) throw new Error('Order not found');
    if (order.paymentStatus !== 'PAID') throw new Error('Order not paid');

    // Check if delivery exists
    const existing = await prisma.delivery.findUnique({
      where: { orderId },
    });

    if (existing) throw new Error('Delivery already exists');

    // Validate merchant location
    if (!order.merchant) throw new Error('Merchant not found');
    const merchant = order.merchant;

    if (!merchant.location) {
      throw new Error('Merchant location not set');
    }
    if (!merchant.latitude || !merchant.longitude) {
      throw new Error('Merchant coordinates not set. Please update merchant location.');
    }

    // Generate delivery number
    const deliveryNumber = await this.generateDeliveryNumber();

    // Merchant pickup location
    const deliveryData = {
      pickupAddress: merchant.location,
      pickupLatitude: merchant.latitude,
      pickupLongitude: merchant.longitude,
      deliveryAddress: 'Customer Location', // TODO: Get from customer
      deliveryLatitude: 6.5355, // TODO: Get from customer
      deliveryLongitude: 3.3087, // TODO: Get from customer
      recipientName: order.customerPhone,
      recipientPhone: order.customerPhone,
    };

    // Find available rider
    const rider = await this.findAvailableRider();

    // Create delivery
    const delivery = await prisma.delivery.create({
      data: {
        deliveryNumber,
        orderId,
        provider: 'IN_HOUSE',
        riderId: rider?.id ?? null,
        status: rider ? DeliveryStatus.ASSIGNED : DeliveryStatus.PENDING,
        ...deliveryData,
        ...(rider && { assignedAt: new Date() }),
      },
    });

    // Log event
    await this.logEvent(delivery.id, delivery.status);

    // Update rider if assigned
    if (rider) {
      await prisma.rider.update({
        where: { id: rider.id },
        data: { status: 'BUSY' },
      });

      // Notify rider via socket
      try {
        const io = getIO();
        io.to(`rider-${rider.userId}`).emit('new-delivery', {
          deliveryId: delivery.id,
          deliveryNumber,
          ...deliveryData,
        });
      } catch (error) {
        console.error('Socket error:', error);
      }
    }

    // Notify customer
    await whatsappService.sendMessage(
      order.customerPhone,
      `🚚 Your order is out for delivery!

Delivery Number: ${deliveryNumber}
Order: ${order.orderNumber}

We'll notify you when the rider is nearby.`
    );

    console.log('Delivery created:', { deliveryNumber, riderId: rider?.id });
    return delivery;
  }

  async updateStatus(
    deliveryId: string,
    status: DeliveryStatus,
    metadata?: { description?: string }
  ) {
    const delivery = await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status,
        ...(status === DeliveryStatus.ASSIGNED && { assignedAt: new Date() }),
        ...(status === DeliveryStatus.PICKED_UP && { pickedUpAt: new Date() }),
        ...(status === DeliveryStatus.DELIVERED && { deliveredAt: new Date() }),
      },
      include: {
        order: true,
        rider: true,
      },
    });

    // Log event
    await this.logEvent(deliveryId, status, metadata?.description);

    // Emit socket event
    try {
      const io = getIO();
      io.emit('delivery-status-updated', {
        deliveryId,
        status,
        delivery,
      });
    } catch (error) {
      console.error('Socket error:', error);
    }

    // Notify customer
    await this.notifyCustomer(delivery, status);

    return delivery;
  }

  async getAllDeliveries(status?: DeliveryStatus | 'ALL') {
    const where = status && status !== 'ALL' ? { status } : {};

    return await prisma.delivery.findMany({
      where,
      include: {
        order: true,
        rider: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDeliveryById(deliveryId: string) {
    return await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        order: true,
        rider: true,
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  private async findAvailableRider() {
    return await prisma.rider.findFirst({
      where: { status: 'AVAILABLE' },
    });
  }

  private async notifyCustomer(delivery: any, status: DeliveryStatus) {
    const messages: Record<string, string> = {
      [DeliveryStatus.ASSIGNED]: `✅ Rider assigned!

Delivery: ${delivery.deliveryNumber}
Rider: ${delivery.rider?.firstName || 'On the way'}`,

      [DeliveryStatus.PICKED_UP]: `📦 Order picked up!

Your order is on its way.`,

      [DeliveryStatus.IN_TRANSIT]: `🚚 Order in transit

Your rider is heading to your location.`,

      [DeliveryStatus.DELIVERED]: `✅ Delivered!

Thank you for shopping with us! 🎉`,
    };

    const message = messages[status];
    if (message && delivery.order) {
      await whatsappService.sendMessage(delivery.order.customerPhone, message);
    }
  }

  private async logEvent(
    deliveryId: string,
    status: DeliveryStatus,
    description?: string
  ) {
    await prisma.deliveryEvent.create({
      data: {
        deliveryId,
        status,
        ...(description && { description }),
      },
    });
  }

  private async generateDeliveryNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const prefix = `DEL-${year}${month}${day}`;

    const count = await prisma.delivery.count({
      where: {
        deliveryNumber: {
          startsWith: prefix,
        },
      },
    });

    const nextNumber = (count + 1).toString().padStart(4, '0');
    return `${prefix}-${nextNumber}`;
  }
}