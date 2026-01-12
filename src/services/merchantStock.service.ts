import prisma from '../config/database';
import { getIO } from '../config/socket';

export class MerchantStockService {
  // Get all products for a merchant
  async getMerchantProducts(merchantId: string) {
    const products = await prisma.product.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' }
    });

    return products;
  }

  // Get single product
  async getProductById(productId: string, merchantId: string) {
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        merchantId
      }
    });

    if (!product) {
      throw new Error('Product not found or access denied');
    }

    return product;
  }

  // Update product stock
  async updateStock(productId: string, merchantId: string, newStock: number) {
    // Verify product belongs to merchant
    await this.getProductById(productId, merchantId);

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        stockQuantity: newStock,
        // Auto-disable if stock is 0
        ...(newStock === 0 && { isActive: false })
      }
    });

    // Emit real-time stock update
    try {
      const io = getIO();
      io.emit('stock-updated', {
        products: [{
          id: updated.id,
          stockQuantity: updated.stockQuantity
        }]
      });
    } catch (error) {
      console.error('Socket emit error:', error);
    }

    return updated;
  }

  // Bulk update stock
  async bulkUpdateStock(merchantId: string, updates: Array<{ productId: string; stock: number }>) {
    const results = [];

    for (const update of updates) {
      try {
        const product = await this.updateStock(update.productId, merchantId, update.stock);
        results.push({ success: true, productId: update.productId, product });
      } catch (error: any) {
        results.push({ success: false, productId: update.productId, error: error.message });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      successful,
      failed,
      results
    };
  }

  // Get stock statistics
  async getStockStats(merchantId: string) {
    const [
      totalProducts,
      inStock,
      lowStock,
      outOfStock
    ] = await Promise.all([
      prisma.product.count({ where: { merchantId } }),
      prisma.product.count({ where: { merchantId, stockQuantity: { gt: 20 } } }),
      prisma.product.count({ where: { merchantId, stockQuantity: { gt: 0, lte: 20 } } }),
      prisma.product.count({ where: { merchantId, stockQuantity: 0 } })
    ]);

    return {
      totalProducts,
      inStock,
      lowStock,
      outOfStock
    };
  }
}