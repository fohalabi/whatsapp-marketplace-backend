import prisma from '../config/database';
import { Response } from 'express';
import { ProductService } from '../services/product.service';
import { AuthRequest } from '../types/auth.types';

const productService = new ProductService();

export class ProductController {
  async createProduct(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      // Get merchant ID from user
      const merchant = await prisma.merchant.findUnique({
        where: { userId: req.user.userId },
      });

      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: 'Merchant profile not found',
        });
      }

      if (merchant.verificationStatus !== 'VERIFIED') {
        return res.status(403).json({
          success: false,
          message: 'Merchant account must be verified to add products',
        });
      }

      // Get uploaded image paths
      const files = req.files as Express.Multer.File[];
      const imagePaths = files.map(file => `/uploads/products/${file.filename}`);

      // Parse variants if exists
      let variants = null;
      if (req.body.variants) {
        variants = JSON.parse(req.body.variants);
      }

      const productData = {
        name: req.body.name,
        description: req.body.description,
        category: req.body.category,
        price: parseFloat(req.body.price),
        stockQuantity: parseInt(req.body.stockQuantity),
        unit: req.body.unit,
        minOrderQty: parseInt(req.body.minOrderQty),
        variants,
      };

      const product = await productService.createProduct(merchant.id, productData, imagePaths);

      res.status(201).json({
        success: true,
        message: 'Product submitted for review',
        data: product,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getMerchantProducts(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const merchant = await prisma.merchant.findUnique({
        where: { userId: req.user.userId },
      });

      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: 'Merchant profile not found',
        });
      }

      const products = await productService.getMerchantProducts(merchant.id);

      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateProduct(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { productId } = req.params;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required',
        });
      }

      const merchant = await prisma.merchant.findUnique({
        where: { userId: req.user.userId },
      });

      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: 'Merchant profile not found',
        });
      }

      const product = await productService.updateProduct(productId as string, merchant.id, req.body);

      res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        data: product,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async deleteProduct(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { productId } = req.params;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required',
        });
      }

      const merchant = await prisma.merchant.findUnique({
        where: { userId: req.user.userId },
      });

      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: 'Merchant profile not found',
        });
      }

      const result = await productService.deleteProduct(productId as string, merchant.id);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateProductStock(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { productId } = req.params;
      const { stock } = req.body;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required',
        });
      }

      if (stock === undefined || stock < 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid stock quantity is required',
        });
      }

      const merchant = await prisma.merchant.findUnique({
        where: { userId: req.user.userId },
      });

      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: 'Merchant profile not found',
        });
      }

      const product = await productService.updateProductStock(
        productId,
        merchant.id,
        parseInt(stock)
      );

      res.status(200).json({
        success: true,
        message: 'Stock updated successfully',
        data: product,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}