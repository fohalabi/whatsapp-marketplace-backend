import prisma from '../config/database';

export class RiderApprovalService {
  async getPendingRiders() {
    return await prisma.rider.findMany({
      where: { approvalStatus: 'PENDING' },
      include: {
        user: {
          select: {
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllRiders(status?: string) {
    const where = status ? { approvalStatus: status } : {};

    return await prisma.rider.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
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