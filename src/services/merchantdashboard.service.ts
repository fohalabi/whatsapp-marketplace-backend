import prisma from '../config/database';

export class DashboardService {
  async getMerchantDashboard(merchantId: string, timeFrame: 'today' | '7days' | '30days' = 'today') {
    try {
      const dateRange = this.getDateRange(timeFrame);

      // Fetch all data in parallel
      const [
        stats,
        salesTrend,
        categoryPerformance,
        topProducts,
        recentOrders,
        lowStockProducts,
        deliveryZones,
        walletBalance,
        customerMetrics
      ] = await Promise.all([
        this.getStats(merchantId, dateRange),
        this.getSalesTrend(merchantId, dateRange),
        this.getCategoryPerformance(merchantId),
        this.getTopProducts(merchantId, dateRange),
        this.getRecentOrders(merchantId),
        this.getLowStockProducts(merchantId),
        this.getDeliveryZonePerformance(merchantId, dateRange),
        this.getWalletBalance(merchantId),
        this.getCustomerMetrics(merchantId, dateRange)
      ]);

      return {
        stats: {
          ...stats,
          walletBalance,
          recentOrders
        },
        salesTrend,
        categoryPerformance,
        topProducts,
        lowStockProducts,
        deliveryZones,
        customerMetrics,
        timeFrame,
        generatedAt: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('Error fetching merchant dashboard:', error);
      throw new Error('Failed to fetch dashboard data');
    }
  }

  private async getStats(merchantId: string, dateRange: { start: Date; end: Date }) {
    const [ordersToPrepare, totalProducts, lowStockCount, totalOrders, totalRevenue] = await Promise.all([
      // Orders pending or processing
      prisma.customerOrder.count({
        where: {
          merchantId,
          status: { in: ['PENDING', 'PROCESSING'] }
        }
      }),

      // Total products
      prisma.product.count({
        where: { merchantId }
      }),

      // Low stock count
      prisma.product.count({
        where: {
          merchantId,
          stockQuantity: { lt: 10 }
        }
      }),

      // Total orders in time frame
      prisma.customerOrder.count({
        where: {
          merchantId,
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end
          }
        }
      }),

      // Total revenue in time frame
      prisma.customerOrder.aggregate({
        where: {
          merchantId,
          paymentStatus: 'PAID',
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end
          }
        },
        _sum: { totalAmount: true }
      })
    ]);

    const totalRevenuAmount = totalRevenue._sum.totalAmount || 0;
    const averageOrderValue = totalOrders > 0 ? totalRevenuAmount / totalOrders : 0;

    return {
      totalProducts,
      ordersToPrepare,
      lowStockCount,
      totalOrders,
      totalRevenue: totalRevenuAmount,
      averageOrderValue
    };
  }

  private async getSalesTrend(merchantId: string, dateRange: { start: Date; end: Date }) {
    const orders = await prisma.customerOrder.findMany({
      where: {
        merchantId,
        paymentStatus: 'PAID',
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end
        }
      },
      select: {
        totalAmount: true,
        createdAt: true,
        items: {
          select: {
            quantity: true
          }
        }
      }
    });

    const groupedByDay = this.groupOrdersByDay(orders);

    return Array.from(groupedByDay.entries()).map(([day, data]) => ({
      day,
      orders: data.ordersCount,
      revenue: data.totalRevenue,
      profit: data.totalRevenue * 0.15 // Assuming 15% profit margin
    }));
  }

  private async getCategoryPerformance(merchantId: string) {
    const products = await prisma.product.findMany({
      where: { merchantId },
      select: {
        category: true,
        price: true,
        customerOrderItems: {
          select: {
            quantity: true
          }
        }
      }
    });

    const categoryMap = new Map<string, { revenue: number; orders: number }>();

    products.forEach(product => {
      const category = product.category || 'Uncategorized';
      const itemsRevenue = product.customerOrderItems.reduce((sum, item) => sum + (item.quantity * product.price), 0);
      const itemsCount = product.customerOrderItems.reduce((sum, item) => sum + item.quantity, 0);

      const existing = categoryMap.get(category) || { revenue: 0, orders: 0 };
      categoryMap.set(category, {
        revenue: existing.revenue + itemsRevenue,
        orders: existing.orders + itemsCount
      });
    });

    const totalRevenue = Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.revenue, 0);

    return Array.from(categoryMap.entries())
      .map(([name, data]) => ({
        name,
        value: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0,
        orders: data.orders,
        revenue: data.revenue,
        color: this.getCategoryColor(name)
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  private async getTopProducts(merchantId: string, dateRange: { start: Date; end: Date }) {
    const products = await prisma.product.findMany({
      where: { merchantId },
      select: {
        id: true,
        name: true,
        price: true,
        customerOrderItems: {
          where: {
            order: {
              createdAt: {
                gte: dateRange.start,
                lte: dateRange.end
              }
            }
          },
          select: {
            quantity: true
          }
        }
      }
    });

    return products
      .map((product: any) => {
        const totalOrders = product.customerOrderItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
        const totalRevenue = totalOrders * product.price;

        return {
          name: product.name,
          orders: totalOrders,
          revenue: totalRevenue,
          rating: 4.5 // Default rating
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  private async getRecentOrders(merchantId: string) {
    const orders = await prisma.customerOrder.findMany({
      where: { merchantId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              select: { name: true }
            }
          }
        }
      }
    });

    return orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      items: order.items.map(item => ({
        productName: item.product.name,
        quantity: item.quantity,
        price: item.price
      }))
    }));
  }

  private async getLowStockProducts(merchantId: string) {
    const products = await prisma.product.findMany({
      where: {
        merchantId,
        stockQuantity: { lt: 10 }
      },
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        unit: true
      },
      orderBy: { stockQuantity: 'asc' }
    });

    return products;
  }

  private async getDeliveryZonePerformance(merchantId: string, dateRange: { start: Date; end: Date }) {
    try {
      // Get merchant's orders in time frame
      const orders = await prisma.customerOrder.findMany({
        where: {
          merchantId,
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end
          }
        },
        select: { id: true }
      });

      if (orders.length === 0) {
        return [];
      }

      // Get deliveries for these orders
      const deliveries = await prisma.delivery.findMany({
        where: {
          orderId: { in: orders.map(o => o.id) },
          status: 'DELIVERED'
        },
        select: {
          deliveryAddress: true,
          pickedUpAt: true,
          deliveredAt: true
        }
      });

      const zoneMap = new Map<string, { orders: number; deliveryTimes: number[] }>();

      deliveries.forEach(delivery => {
        const zone = this.extractZoneFromAddress(delivery.deliveryAddress);
        const existing = zoneMap.get(zone) || { orders: 0, deliveryTimes: [] };

        let deliveryTime = 0;
        if (delivery.deliveredAt && delivery.pickedUpAt) {
          deliveryTime = (delivery.deliveredAt.getTime() - delivery.pickedUpAt.getTime()) / (1000 * 60);
        }

        zoneMap.set(zone, {
          orders: existing.orders + 1,
          deliveryTimes: [...existing.deliveryTimes, deliveryTime]
        });
      });

      return Array.from(zoneMap.entries())
        .map(([zone, data]) => ({
          zone,
          orders: data.orders,
          deliveryTime: data.deliveryTimes.length > 0
            ? Math.round(data.deliveryTimes.reduce((a, b) => a + b) / data.deliveryTimes.length)
            : 0
        }))
        .sort((a, b) => b.orders - a.orders);
    } catch (error) {
      console.error('Error calculating delivery zones:', error);
      return [];
    }
  }

  private async getWalletBalance(merchantId: string) {
    try {
      const wallet = await prisma.merchantWallet.findUnique({
        where: { merchantId },
        select: { balance: true }
      });

      return wallet?.balance || 0;
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      return 0;
    }
  }

  private async getCustomerMetrics(merchantId: string, dateRange: { start: Date; end: Date }) {
    try {
      const orders = await prisma.customerOrder.findMany({
        where: {
          merchantId,
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end
          }
        },
        select: {
          id: true,
          totalAmount: true,
          customerEmail: true
        }
      });

      const uniqueCustomers = new Set(orders.map(o => o.customerEmail));
      const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

      return {
        newCustomers: uniqueCustomers.size,
        repeatRate: 0, // Can be enhanced with historical data
        averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
        averageRating: 4.5
      };
    } catch (error) {
      console.error('Error calculating customer metrics:', error);
      return {
        newCustomers: 0,
        repeatRate: 0,
        averageOrderValue: 0,
        averageRating: 0
      };
    }
  }

  // ===== HELPER METHODS =====

  private getDateRange(timeFrame: 'today' | '7days' | '30days') {
    const now = new Date();
    const start = new Date();

    switch (timeFrame) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case '7days':
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case '30days':
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        break;
    }

    return { start, end: now };
  }

  private groupOrdersByDay(orders: any[]) {
    const groups = new Map<string, { totalRevenue: number; ordersCount: number }>();

    orders.forEach(order => {
      const day = order.createdAt.toLocaleDateString('en-US', { weekday: 'short' });

      const existing = groups.get(day) || { totalRevenue: 0, ordersCount: 0 };
      const itemsCount = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);

      groups.set(day, {
        totalRevenue: existing.totalRevenue + order.totalAmount,
        ordersCount: existing.ordersCount + itemsCount
      });
    });

    return groups;
  }

  private extractZoneFromAddress(address: string): string {
    if (!address) return 'Unknown';

    // Common zones in Lagos
    const zones = [
      'Ikeja', 'Victoria Island', 'Lekki', 'Surulere', 'Yaba',
      'Ajah', 'Gbagada', 'Ikorodu', 'Magodo', 'Ogba',
      'Maryland', 'Ojota', 'Anthony', 'Ilaje', 'Bariga'
    ];

    const addressLower = address.toLowerCase();
    for (const zone of zones) {
      if (addressLower.includes(zone.toLowerCase())) {
        return zone;
      }
    }

    // Extract from address pattern (second part after comma)
    const parts = address.split(',');
    if (parts.length > 1 && parts[1]) {
      return parts[1].trim().split(' ')[0] || 'Unknown';
    }

    const firstWord = address.split(' ')[0];
    return firstWord || 'Unknown';
  }

  private getCategoryColor(categoryName: string): string {
    const colors = [
      '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe',
      '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d',
      '#4ECDC4', '#FF6B6B', '#45B7D1', '#FFE66D', '#95E1D3'
    ];

    const hash = categoryName.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    return colors[Math.abs(hash) % colors.length] || colors[0];
  }
}