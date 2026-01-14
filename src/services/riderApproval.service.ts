import prisma from '../config/database';

export class RiderApprovalService {
  async getPendingRiders() {
    return await prisma.rider.findMany({
      where: { approvalStatus: 'PENDING' },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllRiders(status?: string) {
    try {
      const where = status ? { approvalStatus: status } : {};

      return await prisma.rider.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      console.error('❌ getAllRiders error:', error);
      throw error;
    }
  }

  async approveRider(riderId: string, adminId: string) {
    return await prisma.rider.update({
      where: { id: riderId },
      data: {
        approvalStatus: 'APPROVED',
        approvedBy: adminId,
        approvedAt: new Date(),
      },
    });
  }

  async rejectRider(riderId: string, adminId: string, reason: string) {
    return await prisma.rider.update({
      where: { id: riderId },
      data: {
        approvalStatus: 'REJECTED',
        approvedBy: adminId,
        rejectionReason: reason,
        approvedAt: new Date(),
      },
    });
  }
}