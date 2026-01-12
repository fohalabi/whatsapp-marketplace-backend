import prisma from '../config/database';
import { DeliveryStatus } from '@prisma/client';
import { getIO } from '../config/socket';
import { get } from 'node:http';

export class FulfillmentService {
    async getAllFulFillments(filters: {
        pickupStatus?: string;
        deliveryStatus?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) {
        const { pickupStatus, deliveryStatus, search, page = 1, limit = 20} = filters;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (pickupStatus && pickupStatus !== 'All') {
            if (pickupStatus === 'Pending') {
                where.status = DeliveryStatus.PENDING;
            } else if (pickupStatus === 'Ready for Pickup') {
                where.status = DeliveryStatus.ASSIGNED;
            } else if (pickupStatus === 'Picked up') {
                where.status = DeliveryStatus.PICKED_UP;
            }
        }

        if (deliveryStatus && deliveryStatus !== 'All') {
            if (deliveryStatus === 'Awaiting Pickup') {
                where.status = { in: [DeliveryStatus.PENDING, DeliveryStatus.ASSIGNED] };
            } else if (deliveryStatus === 'In Transit') {
                where.status = DeliveryStatus.IN_TRANSIT;
            } else if (deliveryStatus === 'Out for Delivery') {
                where.status = DeliveryStatus.IN_TRANSIT;
            }
        }

        if (search) {
            where.OR = [
                { deliveryNumber: { contains: search, mode: 'insensitive' } },
                { order: { orderNumber: { contains: search, mode: 'insensitive' } } }
            ];
        }

        const [deliveries, total] = await Promise.all([
            prisma.delivery.findMany({
                where,
                include: {
                    order: {
                        include: {
                            items: {
                                include: {
                                    product: true
                                }
                            },
                            merchant: {
                                select: {
                                    businessName: true
                                }
                            }
                        }
                    },
                    rider: {
                        select: {
                            firstName: true,
                            lastName: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.delivery.count({ where })
        ]);

        return {
            deliveries,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
        };
    }

    async getDeliveryById(deliveryId: string) {
        const delivery = await prisma.delivery.findUnique({
            where: { id: deliveryId },
            include: {
                order: {
                    include: {
                        items: {
                            include: {
                                product: true
                            }
                        },
                        merchant: true
                    }
                },
                rider: true,
                events: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!delivery) {
            throw new Error('Delivery not found');
        }

        return delivery;
    }

    async assignRider(deliveryId: string, riderId: string, userId: string) {
        const delivery = await this.getDeliveryById(deliveryId);

        // check if rider exists and is available
        const rider = await prisma.rider.findUnique({
            where: { id: riderId }
        });

        if (!rider) {
            throw new Error('Rider not found');
        }

        if (rider.status !== 'AVAILABLE') {
            throw new Error('Rider is not Available');
        }

        // Update delivery
        const updated = await prisma.delivery.update({
            where: { id: deliveryId },
            data: {
                riderId,
                status: DeliveryStatus.ASSIGNED,
                assignedAt: new Date() 
            },
            include: {
                rider: true,
                order: true
            }
        });

        await prisma.rider.update({
            where: { id: riderId },
            data: { status: 'BUSY' }
        });

        // Log event
        await prisma.deliveryEvent.create({
            data: {
                deliveryId,
                status: DeliveryStatus.ASSIGNED,
                description: `Rider ${rider.firstName} ${rider.lastName} assigned`
            }
        });

        // Activity log 
        await prisma.activityLog.create({
            data: {
                userId,
                action: 'rider_assigned',
                description: `Rider assigned to delivery ${delivery.deliveryNumber}`
            }
        });

        // Emit socket event
        try {
            const io = getIO();
            io.emit('delivery-rider-assigned', {
                deliveryId: updated.id,
                deliveryNumber: updated.deliveryNumber,
                rider: updated.rider
            });
        } catch (error) {
            console.error('Socket emit error:', error);
        }

        return updated;
    }

    async getFulfillmentStats() {
        const [
            total,
            pending,
            inTransit,
            unassigned
        ] = await Promise.all([
            prisma.delivery.count(),
            prisma.delivery.count({ where: { status: DeliveryStatus.PENDING } }),
            prisma.delivery.count({ where: { status: DeliveryStatus.IN_TRANSIT } }),
            prisma.delivery.count({ where: { riderId: null } })
        ]);
    
        return {
            total,
            pending,
            inTransit,
            unassigned
        }
    }

    async notifyMerchant(deliveryId: string, userId: string) {
        const delivery = await this.getDeliveryById(deliveryId);


        // Todo: implement actual notification logic (whatsapp)
        await prisma.activityLog.create({
            data: {
                userId,
                action: 'merchant_notified',
                details: `Merchant notified for delivery ${deliveryId}`
            }
        });

        // Emit socket event
        try {
            const io = getIO();
            io.emit('merchant-pickup-notification', {
                deliveryId: delivery.id,
                deliveryNumber: delivery.deliveryNumber,
                orderId: delivery.order.id,
                orderNumber: delivery.order.orderNumber
            });
        } catch (error) {
            console.error('Socket emit error:', error);
        }

        return { message: 'Merchant Notified successfully' };
    }
} 