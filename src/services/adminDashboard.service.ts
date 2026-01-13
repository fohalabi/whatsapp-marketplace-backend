// services/admin-dashboard.service.ts
import prisma from '../config/database';

export class AdminDashboardService {
    async getAdminStats(timeFrame: 'today' | '7days' | '30days' = 'today') {
        const dateRange = this.getDateRange(timeFrame);

        const [
            totalMerchants,
            totalOrders,
            totalRevenue,
            activeDeliveries,
            pendingMerchantVerifications,
            pendingPayouts,
            platformCommission,
            averageOrderValue
        ] = await Promise.all([
            // Total Merchants
            prisma.merchant.count({
                where: { verificationStatus: 'VERIFIED' }
            }),

            // Total Orders in time frame
            prisma.customerOrder.count({
                where: {
                    createdAt: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    }
                }
            }),

            // Total Revenue in time frame
            prisma.customerOrder.aggregate({
                where: {
                    createdAt: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    },
                    paymentStatus: 'PAID'
                },
                _sum: {
                    totalAmount: true
                }
            }),

            // Active Deliveries
            prisma.delivery.count({
                where: {
                    status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] }
                }
            }),

            // Pending Merchant Verifications
            prisma.merchant.count({
                where: { verificationStatus: 'PENDING' }
            }),

            // Pending Payouts
            prisma.payout.aggregate({
                where: { status: 'PENDING' },
                _sum: {
                    amount: true
                }
            }),

            // Platform Commission (assuming 15% commission)
            prisma.customerOrder.aggregate({
                where: {
                    createdAt: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    },
                    paymentStatus: 'PAID'
                },
                _sum: {
                    totalAmount: true
                }
            }).then(result => (result._sum.totalAmount || 0) * 0.15),

            // Average Order Value
            prisma.customerOrder.aggregate({
                where: {
                    createdAt: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    },
                    paymentStatus: 'PAID'
                },
                _avg: {
                    totalAmount: true
                }
            })
        ]);

        return {
            totalMerchants,
            totalOrders,
            totalRevenue: totalRevenue._sum.totalAmount || 0,
            activeDeliveries,
            pendingMerchantVerifications,
            pendingPayouts: pendingPayouts._sum.amount || 0,
            platformCommission,
            averageOrderValue: averageOrderValue._avg.totalAmount || 0,
            timeFrame
        };
    }

    async getRevenueTrend(timeFrame: 'today' | '7days' | '30days' = '7days') {
        const dateRange = this.getDateRange(timeFrame);
        const groupBy = timeFrame === 'today' ? 'hour' : 'day';

        const orders = await prisma.customerOrder.findMany({
            where: {
                createdAt: {
                    gte: dateRange.start,
                    lte: dateRange.end
                },
                paymentStatus: 'PAID'
            },
            select: {
                totalAmount: true,
                createdAt: true
            }
        });

        // Group data by time period
        const groupedData = this.groupDataByTimePeriod(orders, groupBy);

        // Format for chart
        return groupedData.map(item => ({
            period: item.period,
            revenue: item.totalAmount,
            profit: item.totalAmount * 0.15, // Assuming 15% profit margin
            orders: item.count
        }));
    }

    async getCategoryPerformance() {
        // First, get all categories that have products
        const categories = await prisma.product.findMany({
            distinct: ['category'],
            select: {
                category: true
            },
            where: {
                category: {
                    not: ''
                },
                orderItems: {
                    some: {}
                }
            }
        });

        // For each category, calculate revenue and orders
        const categoryPerformance = await Promise.all(
            categories.map(async ({ category }) => {
                const categoryName = category || 'Uncategorized';

                // Get all products in this category with their order items
                const products = await prisma.product.findMany({
                    where: {
                        category: categoryName,
                        orderItems: {
                            some: {}
                        }
                    },
                    select: {
                        price: true,
                        orderItems: {
                            select: {
                                quantity: true
                            }
                        }
                    }
                });

                // Calculate totals
                const revenue = products.reduce((sum, product) => {
                    const productRevenue = product.orderItems.reduce((itemSum, item) =>
                        itemSum + (item.quantity * product.price), 0
                    );
                    return sum + productRevenue;
                }, 0);

                const orders = products.reduce((sum, product) => {
                    const productOrders = product.orderItems.reduce((itemSum, item) =>
                        itemSum + item.quantity, 0
                    );
                    return sum + productOrders;
                }, 0);

                return {
                    name: categoryName,
                    revenue,
                    orders
                };
            })
        );

        // Calculate total revenue for percentages
        const totalRevenue = categoryPerformance.reduce((sum, cat) => sum + cat.revenue, 0);

        // Format with percentages and colors
        return categoryPerformance.map(cat => ({
            name: cat.name,
            value: totalRevenue > 0 ? Math.round((cat.revenue / totalRevenue) * 100) : 0,
            revenue: cat.revenue,
            orders: cat.orders,
            color: this.getCategoryColor(cat.name)
        })).sort((a, b) => b.revenue - a.revenue); // Sort by revenue descending
    }

    async getTopMerchants(limit: number = 5) {
        const merchants = await prisma.merchant.findMany({
            where: { verificationStatus: 'VERIFIED' },
            include: {
                orders: {
                    select: {
                        id: true,
                        totalAmount: true,
                        createdAt: true
                    },
                    where: {
                        createdAt: {
                            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                        }
                    }
                },
                _count: {
                    select: { products: true }
                }
            }
        });

        const merchantsWithStats = merchants.map(merchant => {
            const totalOrders = merchant.orders.length;
            const totalRevenue = merchant.orders.reduce((sum, order) => sum + order.totalAmount, 0);
            const recentOrders = merchant.orders.length;

            return {
                id: merchant.id,
                name: merchant.businessName || 'Unnamed Merchant',
                orders: totalOrders,
                revenue: totalRevenue,
                rating: 4.5, // You might want to calculate this from reviews
                productsCount: merchant._count.products,
                recentOrders,
                commission: totalRevenue * 0.15 // Assuming 15% commission
            };
        });

        return merchantsWithStats
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, limit);
    }

    async getDeliveryZonePerformance() {
        const deliveries = await prisma.delivery.findMany({
            where: {
                status: 'DELIVERED',
                deliveredAt: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                }
            },
            select: {
                deliveryAddress: true,
                assignedAt: true,
                pickedUpAt: true,
                deliveredAt: true,
                deliveryFee: true,
                order: {
                    select: {
                        totalAmount: true
                    }
                }
            }
        });

        // Extract zones from addresses
        const zoneMap = new Map<string, {
            orders: number;
            totalRevenue: number;
            deliveryTimes: number[];
            totalFees: number;
        }>();

        deliveries.forEach(delivery => {
            const zone = this.extractZoneFromAddress(delivery.deliveryAddress);
            const zoneData = zoneMap.get(zone) || {
                orders: 0,
                totalRevenue: 0,
                deliveryTimes: [],
                totalFees: 0
            };

            // Calculate delivery time
            let deliveryTime = 0;
            if (delivery.deliveredAt && delivery.pickedUpAt) {
                deliveryTime = (delivery.deliveredAt.getTime() - delivery.pickedUpAt.getTime()) / (1000 * 60);
            }

            zoneMap.set(zone, {
                orders: zoneData.orders + 1,
                totalRevenue: zoneData.totalRevenue + (delivery.order?.totalAmount || 0),
                deliveryTimes: [...zoneData.deliveryTimes, deliveryTime],
                totalFees: zoneData.totalFees + (delivery.deliveryFee || 0)
            });
        });

        // Format result
        return Array.from(zoneMap.entries()).map(([zone, data]) => ({
            zone,
            orders: data.orders,
            revenue: data.totalRevenue,
            deliveryTime: data.deliveryTimes.length > 0
                ? Math.round(data.deliveryTimes.reduce((a, b) => a + b) / data.deliveryTimes.length)
                : 0,
            averageFee: data.orders > 0 ? data.totalFees / data.orders : 0
        })).sort((a, b) => b.revenue - a.revenue);
    }

    async getOrderFlowStatus() {
        const counts = await Promise.all([
            // Awaiting Payment
            prisma.customerOrder.count({
                where: { paymentStatus: 'PENDING' }
            }),

            // Awaiting Pickup
            prisma.customerOrder.count({
                where: {
                    status: 'PENDING',
                    paymentStatus: 'PAID'
                }
            }),

            // In Delivery
            prisma.customerOrder.count({
                where: {
                    status: 'SHIPPED',
                }
            }),

            // Completed
            prisma.customerOrder.count({
                where: {
                    status: 'DELIVERED',
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                    }
                }
            }),

            // Issues
            prisma.customerOrder.count({
                where: {
                    status: 'CANCELLED',
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                    }
                }
            })
        ]);

        return {
            'awaiting-payment': counts[0],
            'awaiting-pickup': counts[1],
            'in-delivery': counts[2],
            'completed': counts[3],
            'issues': counts[4]
        };
    }

    async getAlerts() {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const alerts = [];

        // Delivery delays
        const delayedDeliveriesFetch = await prisma.delivery.findMany({
            where: {
                status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] },
                assignedAt: {
                    lte: new Date(now.getTime() - 2 * 60 * 60 * 1000) // More than 2 hours
                }
            },
            include: {
                order: {
                    select: {
                        merchantId: true
                    }
                }
            }
        });
        const merchants = await prisma.merchant.findMany({
            where: {
                id: { in: delayedDeliveriesFetch.map(d => d.order.merchantId) }
            }
        });
        const merchantNames = merchants.map(m => m.businessName);
        const delayedDeliveries = delayedDeliveriesFetch.map(d => {
            return {
                id: d.id,
                deliveryAddress: d.deliveryAddress,
                assignedAt: d.assignedAt,
                pickedUpAt: d.pickedUpAt,
                deliveredAt: d.deliveredAt,
                deliveryFee: d.deliveryFee,
                merchantName: merchantNames.find(m => m === d.order.merchantId)
            };
        });


        if (delayedDeliveries.length > 0) {
            alerts.push({
                type: 'delivery',
                message: `${delayedDeliveries.length} deliveries delayed by more than 2 hours`,
                time: 'Recent',
                data: {
                    count: delayedDeliveries.length,
                    zones: [...new Set(delayedDeliveries.map(d => this.extractZoneFromAddress(d.deliveryAddress)))]
                }
            });
        }

        // Payment failures
        const paymentFailures = await prisma.customerOrder.count({
            where: {
                paymentStatus: 'FAILED',
                createdAt: {
                    gte: twentyFourHoursAgo
                }
            }
        });

        if (paymentFailures > 0) {
            alerts.push({
                type: 'payment',
                message: `${paymentFailures} payment failures requiring manual verification`,
                time: 'Today',
                data: { count: paymentFailures }
            });
        }

        // Low stock alerts
        const lowStockProducts = await prisma.product.findMany({
            where: {
                stockQuantity: {
                    lt: 10 // Less than 10 items
                }
            },
            select: {
                name: true,
                merchant: {
                    select: {
                        businessName: true
                    }
                }
            }
        });

        if (lowStockProducts.length > 0) {
            alerts.push({
                type: 'stock',
                message: `Low stock alert: ${lowStockProducts.length} products across ${new Set(lowStockProducts.map(p => p.merchant.businessName)).size} merchant stores`,
                time: 'Recent',
                data: {
                    count: lowStockProducts.length,
                    merchants: [...new Set(lowStockProducts.map(p => p.merchant.businessName))]
                }
            });
        }

        return alerts.sort((a, b) => {
            const priority = { delivery: 0, payment: 1, stock: 2, system: 3 };
            return priority[a.type as keyof typeof priority] - priority[b.type as keyof typeof priority];
        });
    }

    async getSystemHealth() {
        // Check various system components
        const checks = await Promise.all([
            // Database connection
            prisma.$queryRaw`SELECT 1 as health`.then(() => 'operational').catch(() => 'down'),

            // Payment gateway (simulated)
            this.checkPaymentGateway(),

            // Delivery partner API (simulated)
            this.checkDeliveryPartner(),

            // WhatsApp API (simulated)
            this.checkWhatsAppAPI()
        ]);

        return [
            { service: 'Database', status: checks[0], icon: 'database' },
            { service: 'Payment Gateway', status: checks[1], icon: 'credit-card' },
            { service: 'Delivery Partner', status: checks[2], icon: 'truck' },
            { service: 'WhatsApp API', status: checks[3], icon: 'message-square' }
        ];
    }

    async getQuickStats() {
        const [
            newMerchantsToday,
            newOrdersToday,
            totalRevenueToday,
            activeUsersToday
        ] = await Promise.all([
            prisma.merchant.count({
                where: {
                    createdAt: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }
            }),

            prisma.order.count({
                where: {
                    createdAt: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }
            }),

            prisma.customerOrder.aggregate({
                where: {
                    createdAt: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0))
                    },
                    paymentStatus: 'PAID'
                },
                _sum: {
                    totalAmount: true
                }
            }),

            prisma.user.count({
                where: {
                    isActive: true,
                }
            })
        ]);

        return {
            newMerchantsToday,
            newOrdersToday,
            totalRevenueToday: totalRevenueToday._sum.totalAmount || 0,
            activeUsersToday
        };
    }

    // Helper methods
    private getDateRange(timeFrame: 'today' | '7days' | '30days') {
        const now = new Date();
        const start = new Date();

        switch (timeFrame) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                break;
            case '7days':
                start.setDate(start.getDate() - 7);
                break;
            case '30days':
                start.setDate(start.getDate() - 30);
                break;
        }

        return { start, end: now };
    }

    private groupDataByTimePeriod(orders: any[], period: 'hour' | 'day') {
        const groups = new Map<string, { totalAmount: number; count: number }>();

        orders.forEach(order => {
            let key: string;

            if (period === 'hour') {
                key = order.createdAt.toISOString().slice(0, 13); // YYYY-MM-DDTHH
            } else {
                key = order.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
            }

            const group = groups.get(key) || { totalAmount: 0, count: 0 };
            groups.set(key, {
                totalAmount: group.totalAmount + order.totalAmount,
                count: group.count + 1
            });
        });

        return Array.from(groups.entries()).map(([key, data]) => ({
            period: period === 'hour'
                ? new Date(key + ':00:00').toLocaleTimeString('en-US', { hour: '2-digit', hour12: true })
                : new Date(key).toLocaleDateString('en-US', { weekday: 'short' }),
            totalAmount: data.totalAmount,
            count: data.count
        }));
    }

    private getCategoryColor(categoryName: string): string {
        const colors = [
            '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe',
            '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d',
            '#4ECDC4', '#FF6B6B', '#45B7D1', '#FFE66D', '#95E1D3'
        ];

        // Simple hash function to get consistent colors
        const hash = categoryName.split('').reduce((acc, char) => {
            return char.charCodeAt(0) + ((acc << 5) - acc);
        }, 0);

        return colors[Math.abs(hash) % colors.length];
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

        // If no zone found, take first word after comma
        const parts = address.split(',');
        const secondPart = parts[1];

        if (secondPart) {
            return secondPart.trim().split(' ')[0];
        }

        return address.split(' ')[0];
    }

    private async checkPaymentGateway(): Promise<string> {
        // Simulate payment gateway check
        return Math.random() > 0.1 ? 'operational' : 'degraded';
    }

    private async checkDeliveryPartner(): Promise<string> {
        // Simulate delivery partner check
        return Math.random() > 0.05 ? 'operational' : 'degraded';
    }

    private async checkWhatsAppAPI(): Promise<string> {
        // Simulate WhatsApp API check
        return Math.random() > 0.02 ? 'operational' : 'down';
    }
}