import prisma from '../config/database';
import { WhatsAppService } from './whatsapp.service';

export class RiderService {
  async getRiderProfile(userId: string) {
    const rider = await prisma.rider.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!rider) throw new Error('Rider not found');
    return rider;
  }

  async updateRiderStatus(userId: string, status: 'OFFLINE' | 'AVAILABLE' | 'BUSY') {
    const rider = await prisma.rider.findUnique({
      where: { userId },
    });

    if (!rider) throw new Error('Rider not found');

    // Block unapproved riders from going online
    if (status === 'AVAILABLE' && rider.approvalStatus !== 'APPROVED') {
      throw new Error('Your account is pending approval. Please wait for admin approval.');
    }

    return await prisma.rider.update({
      where: { id: rider.id },
      data: { status },
    });
  }

  async updateLocation(userId: string, latitude: number, longitude: number) {
    const rider = await prisma.rider.findUnique({
      where: { userId },
    });

    if (!rider) throw new Error('Rider not found');

    await prisma.rider.update({
      where: { id: rider.id },
      data: {
        currentLatitude: latitude,
        currentLongitude: longitude,
      },
    });
  }

  async getMyDeliveries(userId: string) {
    const rider = await prisma.rider.findUnique({
      where: { userId },
    });

    if (!rider) throw new Error('Rider not found');

    return await prisma.delivery.findMany({
      where: {
        riderId: rider.id,
        status: {
          in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'],
        },
      },
      include: {
        order: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateDeliveryStatus(
    userId: string,
    deliveryId: string,
    status: 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED',
    proofImage?: string,
    notes?: string
  ) {
    const rider = await prisma.rider.findUnique({
      where: { userId },
    });

    if (!rider) throw new Error('Rider not found');

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) throw new Error('Delivery not found');
    if (delivery.riderId !== rider.id) throw new Error('Not your delivery');

    const updated = await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status,
        ...(status === 'PICKED_UP' && { pickedUpAt: new Date() }),
        ...(status === 'DELIVERED' && {
            deliveredAt: new Date(),
            ...(proofImage && { proofOfDeliveryImage: proofImage }),
            ...(notes && { deliveryNotes: notes }),
        }),
      },
    });

    if (status === 'DELIVERED') {
      // Fetch delivery with order
      const deliveryWithOrder = await prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: { order: true }
      });

      if (!deliveryWithOrder) throw new Error('Delivery not found');

      await prisma.delivery.update({
        where: { id: deliveryId },
        data: {
          confirmationRequestedAt: new Date(),
          autoReleaseAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
        }
      });

      // Send confirmation request to customer
      const whatsappService = new WhatsAppService();
      await whatsappService.sendInteractiveButtons(
        deliveryWithOrder.order.customerPhone,
        `✅ Your order has been delivered!

    Order: ${deliveryWithOrder.order.orderNumber}
    Delivery: ${deliveryWithOrder.deliveryNumber}

    Please confirm you received your order in good condition.`,
        [
          { id: 'confirm_delivery', title: '✅ Confirm Delivery' },
          { id: 'report_issue', title: '⚠️ Report Issue' }
        ]
      );
    }

    // Log event
    await prisma.deliveryEvent.create({
      data: {
        deliveryId,
        status,
        ...(notes && { description: notes }),
      },
    });

    // If delivered, free up rider
    if (status === 'DELIVERED') {
      await prisma.rider.update({
        where: { id: rider.id },
        data: {
          status: 'AVAILABLE',
          totalDeliveries: { increment: 1 },
        },
      });
    }

    return updated;
  }
}