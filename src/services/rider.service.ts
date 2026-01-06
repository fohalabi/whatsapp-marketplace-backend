import prisma from '../config/database';

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