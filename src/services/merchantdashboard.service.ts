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
}