import prisma from '../config/database';

export class DashboardService {
  async getMerchantStats(merchantId: string) {
    const [ordersToPrepare, recentOrders, lowStockItems, productsCount] = await Promise.all([
      // Count orders with PENDING or ACCEPTED status
      prisma.order.count({
        where: {
          merchantId,
          status: { in: ['PENDING', 'ACCEPTED'] }
        }
      }),

      // Get 5 most recent orders with product names
      prisma.order.findMany({
        where: { merchantId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          orderItems: {
            include: {
              product: { select: { name: true } }
            }
          }
        }
      }),

      // Identify low stock items (Quantity < 10)
      prisma.product.findMany({
        where: {
          merchantId,
          stockQuantity: { lt: 10 }
        },
        select: {
          name: true,
          stockQuantity: true,
          unit: true
        }
      }),

      // Count all products listed by merchant
      prisma.product.count({
        where: { merchantId }
      })
    ]);

    return {
      ordersToPrepare,
      productsListed: productsCount,
      lowStockCount: lowStockItems.length,
      recentOrders,
      lowStockItems
    };
  }

  async getSalesTrend(merchantId: string, timeFrame: 'today' | '7days' | '30days' = '7days') {
    // Calculate date range
    const now = new Date();
    let startDate: Date;

    if (timeFrame === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timeFrame === '7days') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else { // 30days
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get orders within the date range
    const orders = await prisma.order.findMany({
      where: {
        merchantId,
        createdAt: {
          gte: startDate,
          lte: now
        }
      },
      select: {
        id: true,
        totalAmount: true,
        createdAt: true,
        orderItems: {
          select: {
            quantity: true
          }
        }
      }
    });

    // Group by day and calculate totals
    const salesByDay = new Map<string, { orders: number, revenue: number }>();

    orders.forEach(order => {
      const day = order.createdAt.toISOString().split('T')[0] || '';
      const existing = salesByDay.get(day) || { orders: 0, revenue: 0 };

      const itemsCount = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);

      salesByDay.set(day, {
        orders: existing.orders + itemsCount,
        revenue: existing.revenue + order.totalAmount
      });
    });

    // Format for chart
    const result = Array.from(salesByDay.entries()).map(([day, data]) => ({
      day: new Date(day).toLocaleDateString('en-US', { weekday: 'short' }),
      orders: data.orders,
      revenue: data.revenue
    })).sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime());

    return result;
  }

  async getCategoryPerformance(merchantId: string) {
    // Get products grouped by category with sales data
    const products = await prisma.product.findMany({
      where: { merchantId },
      select: {
        category: true,
        orderItems: {
          select: {
            quantity: true,
            price: true
          }
        }
      }
    });

    // Calculate sales by category
    const categorySales = new Map<string, number>();

    products.forEach(product => {
      const category = product.category || 'Uncategorized';
      const totalSales = product.orderItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);

      const existing = categorySales.get(category) || 0;
      categorySales.set(category, existing + totalSales);
    });

    // Calculate percentages
    const totalSales = Array.from(categorySales.values()).reduce((sum, val) => sum + val, 0);

    const result = Array.from(categorySales.entries()).map(([name, value]) => ({
      name,
      value: totalSales > 0 ? Math.round((value / totalSales) * 100) : 0,
      color: this.getRandomColor()
    }));

    return result;
  }

  async getTopProducts(merchantId: string, limit: number = 5) {
    const products = await prisma.product.findMany({
      where: { merchantId },
      select: {
        id: true,
        name: true,
        price: true,
        orderItems: {
          select: {
            quantity: true
          }
        }
      }
    });

    // Calculate orders and revenue for each product
    const productsWithStats = products.map(product => {
      const totalOrders = product.orderItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalRevenue = totalOrders * product.price;

      return {
        name: product.name,
        orders: totalOrders,
        revenue: totalRevenue,
      };
    });

    // Sort by orders and limit
    return productsWithStats
      .sort((a, b) => b.orders - a.orders)
      .slice(0, limit);
  }

  async getHourlyPattern(merchantId: string) {
    // Get orders from the last 7 days for hourly pattern
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const orders = await prisma.order.findMany({
      where: {
        merchantId,
        createdAt: {
          gte: startDate
        }
      },
      select: {
        createdAt: true,
        orderItems: {
          select: {
            quantity: true
          }
        }
      }
    });

    // Group by hour
    const hourlyCounts = new Array(12).fill(0).map((_, i) => ({
      hour: `${(i * 2) + 8}AM`,
      orders: 0
    }));

    orders.forEach(order => {
      const hour = order.createdAt.getHours();
      // Map hours to our 12 time slots (8AM-8PM)
      if (hour >= 8 && hour <= 20) {
        const slot = Math.floor((hour - 8) / 2);
        const itemsCount = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);
        if (hourlyCounts[slot]) {
          hourlyCounts[slot].orders += itemsCount;
        }
      }
    });

    return hourlyCounts;
  }

  async getCustomerMetrics(merchantId: string) {
    // Get customer data
    const orders = await prisma.order.findMany({
      where: { merchantId },
      include: {
        customer: {
          select: {
            id: true
          }
        }
      }
    });

    const uniqueCustomers = new Set(orders.map(order => order.customer.id));
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Calculate average order value
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // For repeat rate, we need to identify customers with multiple orders
    const customerOrderCounts = new Map<string, number>();
    orders.forEach(order => {
      const count = customerOrderCounts.get(order.customer.id) || 0;
      customerOrderCounts.set(order.customer.id, count + 1);
    });

    const repeatCustomers = Array.from(customerOrderCounts.values()).filter(count => count > 1).length;
    const repeatRate = uniqueCustomers.size > 0 ? (repeatCustomers / uniqueCustomers.size) * 100 : 0;

    // For rating, use default since Product model doesn't have rating field
    const averageRating = 4.5;

    return [
      {
        metric: 'New Customers',
        value: uniqueCustomers.size,
        change: '+12%' // Mock data - you can calculate real changes
      },
      {
        metric: 'Repeat Rate',
        value: `${Math.round(repeatRate)}%`,
        change: '+5%' // Mock data
      },
      {
        metric: 'Avg Order Value',
        value: `₦${avgOrderValue.toLocaleString('en-NG', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        })}`,
        change: '+8%' // Mock data
      },
      {
        metric: 'Rating',
        value: averageRating.toFixed(1),
        change: '+0.2' // Mock data
      }
    ];
  }

 async getDeliveryZonePerformance(merchantId: string) {
  try {
    // Get merchant's orders with their deliveries

    const orders = await prisma.order.findMany({ where: { merchantId } });
    if (!orders) {
      throw new Error('Order not found');
    }
    const ordersWithDeliveries = await prisma.delivery.findMany({
      where: { orderId: { in: orders.map(order => order.id) } },
      select: {
            deliveryAddress: true,
            deliveryLatitude: true,
            deliveryLongitude: true,
            status: true,
            pickedUpAt: true,
            deliveredAt: true,
            deliveryFee: true,
            orderId: true,
            assignedAt: true,

          }
    });

    // Extract unique delivery zones from addresses
    // This is a simplified approach - you might want to use geocoding API or pre-defined zones
    const zoneData = new Map<string, {
      orders: number,
      deliveryTimeSum: number,
      deliveryTimeCount: number,
      deliveryFeeSum: number
    }>();

    ordersWithDeliveries.forEach(order => {
      if (order) {
        // Extract zone from address (simplified - takes first word before comma)
        // Example: "123 Main St, Ikeja, Lagos" -> "Ikeja"
        const address = order.deliveryAddress;
        let zone : string | undefined = order.deliveryAddress || "Unknown";
        
        if (address) {
          const parts = address.split(',');
          if (parts.length > 1) {
            zone = parts[1]?.trim().split(' ')[0]; // Take first word of second part
          } else {
            zone = address.split(' ')[0]; // Fallback to first word
          }
        }

        const existing = zoneData.get(zone) || { 
          orders: 0, 
          deliveryTimeSum: 0, 
          deliveryTimeCount: 0,
          deliveryFeeSum: 0 
        };

        // Calculate delivery time if delivered
        let deliveryTime = 0;
        if (order.deliveredAt && order.pickedUpAt) {
          deliveryTime = (order.deliveredAt.getTime() - order.pickedUpAt.getTime()) / (1000 * 60); // minutes
        } else if (order.deliveredAt && order.assignedAt) {
          deliveryTime = (order.deliveredAt.getTime() - order.assignedAt.getTime()) / (1000 * 60); // minutes
        }

        zoneData.set(zone, {
          orders: existing.orders + 1,
          deliveryTimeSum: existing.deliveryTimeSum + deliveryTime,
          deliveryTimeCount: deliveryTime > 0 ? existing.deliveryTimeCount + 1 : existing.deliveryTimeCount,
          deliveryFeeSum: existing.deliveryFeeSum + (order.deliveryFee || 0)
        });
      }
    });

    // Convert to array and calculate averages
    const result = Array.from(zoneData.entries()).map(([zone, data]) => ({
      zone,
      orders: data.orders,
      deliveryTime: data.deliveryTimeCount > 0 
        ? Math.round(data.deliveryTimeSum / data.deliveryTimeCount)
        : 0,
      averageFee: data.orders > 0
        ? data.deliveryFeeSum / data.orders
        : 0
    }));

    // Sort by number of orders (descending)
    return result.sort((a, b) => b.orders - a.orders).slice(0, 10); // Top 10 zones

  } catch (error) {
    console.error('Error calculating delivery zone performance:', error);
    return []; // Return empty array on error
  }
}

  // Helper method to generate random colors for charts
  private getRandomColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFE66D', '#95E1D3',
      '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe',
      '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}