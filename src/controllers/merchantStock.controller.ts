import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { MerchantStockService } from '../services/merchantStock.service';

const stockService = new MerchantStockService();

export class MerchantStockController {
  // Get all merchant products
  async getMerchantProducts(req: AuthRequest, res: Response) {
    try {
      const merchantId = req.user!.merchantId;

      if (!merchantId) {
        return res.status(403).json({
          success: false,
          message: 'Merchant ID not found'
        });
      }

      const products = await stockService.getMerchantProducts(merchantId);

      res.json({
        success: true,
        data: products
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get single product
  async getProductById(req: AuthRequest, res: Response) {
    try {
      const { productId } = req.params;
      const merchantId = req.user!.merchantId;

      if (!merchantId) {
        return res.status(403).json({
          success: false,
          message: 'Merchant ID not found'
        });
      }

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }

      const product = await stockService.getProductById(productId, merchantId);

      res.json({
        success: true,
        data: product
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update stock
  async updateStock(req: AuthRequest, res: Response) {
    try {
      const { productId } = req.params;
      const { stock } = req.body;
      const merchantId = req.user!.merchantId;

      if (!merchantId) {
        return res.status(403).json({
          success: false,
          message: 'Merchant ID not found'
        });
      }

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }

      if (stock === undefined || stock < 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid stock quantity is required'
        });
      }

      const product = await stockService.updateStock(
        productId,
        merchantId,
        parseInt(stock)
      );

      res.json({
        success: true,
        message: 'Stock updated successfully',
        data: product
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Bulk update stock
  async bulkUpdateStock(req: AuthRequest, res: Response) {
    try {
      const { updates } = req.body;
      const merchantId = req.user!.merchantId;

      if (!merchantId) {
        return res.status(403).json({
          success: false,
          message: 'Merchant ID not found'
        });
      }

      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Updates array is required'
        });
      }

      const result = await stockService.bulkUpdateStock(merchantId, updates);

      res.json({
        success: true,
        message: `${result.successful} products updated, ${result.failed} failed`,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get stock stats
  async getStockStats(req: AuthRequest, res: Response) {
    try {
      const merchantId = req.user!.merchantId;

      if (!merchantId) {
        return res.status(403).json({
          success: false,
          message: 'Merchant ID not found'
        });
      }

      const stats = await stockService.getStockStats(merchantId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}