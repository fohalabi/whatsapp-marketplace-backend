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
      deliveryAddress: order.deliveryAddress || 'Address pending', 
      deliveryLatitude: order.deliveryLatitude || 6.5355, 
      deliveryLongitude: order.deliveryLongitude || 3.3087,
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

    // Alert if no rider available
    if (!rider)  {
      console.warn ('⚠️ No available rider for delivery:', deliveryNumber);

      // Log to activity log for admin dashboard
      await prisma.activityLog.create({
        data: {
          userId: 'SYSTEM',
          action: 'no_rider_available',
          description: `Delivery ${deliveryNumber} created but no rider available`,
        }
      });

      // Emit socket event to admin dashboard
      try {
        const io = getIO();
        io.emit('rider_shortage-alert', {
          deliveryId: delivery.id,
          deliveryNumber, 
          orderNumber: order.orderNumber,
          message: 'No availabe riders - manual assignment needed'
        });
      } catch (error) {
        console.error('Socket alert failed:', error);
      }

      // Notify customer about slight delay
      await whatsappService.sendMessage(
        order.customerPhone,
        `📦 Your order is confirmed!
        
        We're assigning the best rider for yout delivery. You'll be notified shortly once a rider is assigned.
        
        Order: ${order.orderNumber}
        Delivery: ${deliveryNumber}
        
        Thank you for your patience! `
      );
    }

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

  async reassignDelivery(deliveryId: string, reason?: string) {
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { rider: true, order: true }
    });

    if (!delivery) throw new Error('Delivery not found');

    const previousRider = delivery.rider;

    // Find new available rider (exclude previous rider)
    const newRider = await prisma.rider.findFirst({
      where: {
        status: 'AVAILABLE',
        id: { not: delivery.riderId || undefined }
      }
    });

    if (!newRider) {
      console.warn('⚠️ No available rider for reassignment:', deliveryId);

      // Alert admin
      await prisma.activityLog.create({
        data: {
          userId: 'SYSTEM',
          action: 'delivery_reassignment_failed',
          description: `Delivery ${delivery.deliveryNumber} reassignment failed - no available riders. Reason: ${reason || 'Manual reassignment'}`
        }
      });

      // Emit alert
      try {
        const io = getIO();
        io.emit('delivery-reassignment-failed', {
          deliveryId,
          deliveryNumber: delivery.deliveryNumber,
          reason: reason || 'No available riders'
        });
      } catch (error) {
        console.error('Socket error:', error);
      }

      return null;
    }

    // Update delivery with new rider
    const updated = await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        riderId: newRider.id,
        status: 'ASSIGNED',
        assignedAt: new Date()
      },
      include: { rider: true }
    });

    // Log event
    await this.logEvent(deliveryId, 'ASSIGNED', 
      `Reassigned from ${previousRider?.firstName || 'unassigned'} to ${newRider.firstName}. Reason: ${reason || 'Manual'}`
    );

    // Update rider statuses
    if (previousRider) {
      await prisma.rider.update({
        where: { id: previousRider.id },
        data: { status: 'AVAILABLE' }
      });
    }

    await prisma.rider.update({
      where: { id: newRider.id },
      data: { status: 'BUSY' }
    });

    // Notify new rider
    try {
      const io = getIO();
      io.to(`rider-${newRider.userId}`).emit('new-delivery', {
        deliveryId: updated.id,
        deliveryNumber: updated.deliveryNumber,
        pickupAddress: updated.pickupAddress,
        deliveryAddress: updated.deliveryAddress
      });
    } catch (error) {
      console.error('Socket error:', error);
    }

    // Notify customer
    await whatsappService.sendMessage(
      delivery.order.customerPhone,
      `🔄 Rider Update

        Delivery: ${delivery.deliveryNumber}
        New Rider: ${newRider.firstName}

        Your delivery is being reassigned to ensure timely delivery.`
    );

    console.log(`✅ Delivery reassigned: ${delivery.deliveryNumber} → ${newRider.firstName}`);
    return updated;
  }

  async retryStuckDeliveries() {
    const stuckThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 mins

    // Find deliveries assigned but not picked up after 30 mins
    const stuckDeliveries = await prisma.delivery.findMany({
      where: {
        status: 'ASSIGNED',
        assignedAt: { lt: stuckThreshold }
      },
      include: { rider: true }
    });

    for (const delivery of stuckDeliveries) {
      console.warn(`⚠️ Stuck delivery detected: ${delivery.deliveryNumber}`);
      
      try {
        await this.reassignDelivery(
          delivery.id, 
          'Automatic reassignment - rider not responding'
        );
      } catch (error) {
        console.error(`Failed to reassign delivery ${delivery.deliveryNumber}:`, error);
      }
    }

    return stuckDeliveries.length;
  }
}