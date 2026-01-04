import prisma from '../config/database';

export class ReportService {
  // Helper to get date ranges
  private getDateRange(period: 'daily' | 'weekly' | 'monthly') {
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'daily':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate.setDate(now.getDate() - 30);
        break;
    }

    return { startDate, endDate: now };
  }

  async getFinancialSummary(period: 'daily' | 'weekly' | 'monthly') {
    const { startDate, endDate } = this.getDateRange(period);

    // Get all paid orders in period
    const orders = await prisma.customerOrder.findMany({
      where: {
        paymentStatus: 'PAID',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // GMV - Total order value
    const gmv = orders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Platform Revenue (10% commission example - adjust as needed)
    const platformRevenue = gmv * 0.1;

    // Total Payouts
    const payouts = await prisma.payout.findMany({
      where: {
        status: 'COMPLETED',
        paidOutAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0);

    // Orders count
    const ordersCount = orders.length;

    return {
      gmv,
      platformRevenue,
      totalPayouts,
      ordersCount,
      deliveryCosts: 0, // Add logic if you track this
      taxesCollected: 0, // Add logic if you track this
    };
  }

  async getMerchantPerformance(period: 'daily' | 'weekly' | 'monthly') {
    const { startDate, endDate } = this.getDateRange(period);

    const merchants = await prisma.merchant.findMany({
      include: {
        user: true,
      },
    });

    const performance = await Promise.all(
      merchants.map(async (merchant) => {
        // Get merchant orders
        const orders = await prisma.customerOrder.findMany({
          where: {
            merchantId: merchant.id,
            paymentStatus: 'PAID',
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        });

        const gmv = orders.reduce((sum, o) => sum + o.totalAmount, 0);
        const revenue = gmv * 0.1; // 10% commission

        return {
          merchantId: merchant.id,
          merchantName: merchant.businessName,
          gmv,
          ordersCount: orders.length,
          platformRevenue: revenue,
        };
      })
    );

    return performance.sort((a, b) => b.gmv - a.gmv);
  }

  async getReportComparison() {
    const daily = await this.getFinancialSummary('daily');
    const weekly = await this.getFinancialSummary('weekly');
    const monthly = await this.getFinancialSummary('monthly');

    return {
      daily,
      weekly,
      monthly,
    };
  }
}