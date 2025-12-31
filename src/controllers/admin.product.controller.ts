import { Response } from 'express';
import { AdminProductService } from '../services/admin.product.service';
import { AuthRequest } from '../types/auth.types';

const adminProductService = new AdminProductService();

export class AdminProductController {
  async getAllProducts(req: AuthRequest, res: Response) {
    try {
      const status = req.query.status as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = parseInt(req.query.skip as string) || 0;

      const { products, total } = await adminProductService.getAllProducts(
        status,
        limit,
        skip
      );

      res.status(200).json({
        success: true,
        data: products,
        total,
        limit,
        skip,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async approveProduct(req: AuthRequest, res: Response) {
    try {
      const { productId } = req.params;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required',
        });
      }

      const product = await adminProductService.approveProduct(productId);

      res.status(200).json({
        success: true,
        message: 'Product approved successfully',
        data: product,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async hideProduct(req: AuthRequest, res: Response) {
    try {
      const { productId } = req.params;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required',
        });
      }

      const product = await adminProductService.hideProduct(productId);

      res.status(200).json({
        success: true,
        message: 'Product hidden successfully',
        data: product,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async rejectProduct(req: AuthRequest, res: Response) {
    try {
      const { productId } = req.params;
      const { reason } = req.body;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required',
        });
      }

      if (!reason || !reason.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required',
        });
      }

      const product = await adminProductService.rejectProduct(productId, reason);

      res.status(200).json({
        success: true,
        message: 'Product rejected successfully',
        data: product,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateProductPricing(req: AuthRequest, res: Response) {
    try {
        const { productId } = req.params;
        const { markup } = req.body;

        if (!productId) {
        return res.status(400).json({
            success: false,
            message: 'Product ID is required',
        });
        }

        if (markup === undefined || markup < 0) {
        return res.status(400).json({
            success: false,
            message: 'Valid markup percentage is required',
        });
        }

        const product = await adminProductService.updateProductPricing(
        productId,
        parseFloat(markup)
        );

        res.status(200).json({
        success: true,
        message: 'Pricing updated successfully',
        data: product,
        });
    } catch (error: any) {
        res.status(400).json({
        success: false,
        message: error.message,
        });
    }
  }

  async bulkUpdatePricing(req: AuthRequest, res: Response) {
    try {
        const { productIds, markup } = req.body;

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Product IDs array is required',
        });
        }

        if (markup === undefined || markup < 0) {
        return res.status(400).json({
            success: false,
            message: 'Valid markup percentage is required',
        });
        }

        const result = await adminProductService.bulkUpdatePricing(
        productIds,
        parseFloat(markup)
        );

        res.status(200).json({
        success: true,
        message: `${result.updated} products updated successfully`,
        data: result,
        });
    } catch (error: any) {
        res.status(400).json({
        success: false,
        message: error.message,
        });
    }
  }

  async toggleProductStatus(req: AuthRequest, res: Response) {
    try {
        const { productId } = req.params;
        const { isActive } = req.body;

        if (!productId) {
        return res.status(400).json({
            success: false,
            message: 'Product ID is required',
        });
        }

        if (isActive === undefined) {
        return res.status(400).json({
            success: false,
            message: 'isActive status is required',
        });
        }

        const product = await adminProductService.toggleProductStatus(
        productId,
        isActive
        );

        res.status(200).json({
        success: true,
        message: 'Product status updated successfully',
        data: product,
        });
    } catch (error: any) {
        res.status(400).json({
        success: false,
        message: error.message,
        });
    }
  }

  async getProductsForSync(req: AuthRequest, res: Response) {
    try {
      const products = await adminProductService.getProductsForSync();

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
}