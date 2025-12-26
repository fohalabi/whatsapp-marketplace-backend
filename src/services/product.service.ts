import prisma from '../config/database';
import { CreateProductDTO, UpdateProductDTO } from '../types/product.types';

export class ProductService {
  async createProduct(merchantId: string, data: CreateProductDTO, imagePaths: string[]) {
    if (imagePaths.length === 0) {
      throw new Error('At least one product image is required');
    }

    const product = await prisma.product.create({
      data: {
        merchantId,
        name: data.name,
        description: data.description,
        category: data.category,
        price: data.price,
        stockQuantity: data.stockQuantity,
        unit: data.unit,
        minOrderQty: data.minOrderQty,
        images: imagePaths,
        variants: data.variants ?? [],
      },
      include: {
        merchant: {
          select: {
            businessName: true,
          },
        },
      },
    });

    return product;
  }

  async getMerchantProducts(merchantId: string) {
    const products = await prisma.product.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });

    return products;
  }

  async getProductById(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        merchant: {
          select: {
            businessName: true,
          },
        },
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    return product;
  }

  async updateProduct(productId: string, merchantId: string, data: UpdateProductDTO) {
    // Verify product belongs to merchant
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    if (product.merchantId !== merchantId) {
      throw new Error('Unauthorized to update this product');
    }

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        ...data,
      },
    });

    return updatedProduct;
  }

  async deleteProduct(productId: string, merchantId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    if (product.merchantId !== merchantId) {
      throw new Error('Unauthorized to delete this product');
    }

    await prisma.product.delete({
      where: { id: productId },
    });

    return { message: 'Product deleted successfully' };
  }
}