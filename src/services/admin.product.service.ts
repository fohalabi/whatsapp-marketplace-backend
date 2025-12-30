import prisma from '../config/database';

export class AdminProductService {
  async getAllProducts(
  status?: 'PENDING' | 'APPROVED' | 'REJECTED',
  limit: number = 10,
  skip: number = 0
) {
  const where = status ? { approvalStatus: status } : {};

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        merchant: {
          select: {
            id: true,
            businessName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    }),
    prisma.product.count({ where }),
  ]);

  // Add default values for markup and retailPrice if missing
  const productsWithDefaults = products.map(p => ({
    ...p,
    markup: p.markup ?? 0,
    retailPrice: p.retailPrice ?? p.price,
  }));

  return { products: productsWithDefaults, total };
}

  async approveProduct(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        approvalStatus: 'APPROVED',
        isActive: true,
      },
    });

    return updated;
  }

  async hideProduct(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        isActive: false,
      },
    });

    return updated;
  }

  async rejectProduct(productId: string, reason: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        approvalStatus: 'REJECTED',
        rejectionReason: reason,
        isActive: false,
      },
    });

    return updated;
  }

  async updateProductPricing(productId: string, markup: number) {
    const product = await prisma.product.findUnique({
        where: { id: productId },
    });

    if (!product) {
        throw new Error('Product not found');
    }

    // Calculate retail price
    const retailPrice = product.price + (product.price * markup) / 100;

    const updated = await prisma.product.update({
        where: { id: productId },
        data: {
        markup,
        retailPrice: Math.round(retailPrice),
        },
    });

    return updated;
    }

    async bulkUpdatePricing(productIds: string[], markup: number) {
    // Get all products
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
    });

    // Update each product with calculated retail price
    const updates = products.map((product) => {
        const retailPrice = product.price + (product.price * markup) / 100;
        
        return prisma.product.update({
        where: { id: product.id },
        data: {
            markup,
            retailPrice: Math.round(retailPrice),
        },
        });
    });

    await Promise.all(updates);

    return { updated: productIds.length };
    }

    async toggleProductStatus(productId: string, isActive: boolean) {
    const product = await prisma.product.findUnique({
        where: { id: productId },
    });

    if (!product) {
        throw new Error('Product not found');
    }

    const updated = await prisma.product.update({
        where: { id: productId },
        data: { isActive },
    });

    return updated;
    }
}