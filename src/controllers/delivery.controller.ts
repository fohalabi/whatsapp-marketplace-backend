import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { DeliveryOrchestrator } from '../services/delivery/DeliveryOrchestrator.service';
import { DeliveryStatus } from '@prisma/client';

const deliveryOrchestrator = new DeliveryOrchestrator();

export class DeliveryController {
  async createDelivery(req: AuthRequest, res: Response) {
    try {
      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: 'Order ID is required',
        });
      }

      const delivery = await deliveryOrchestrator.createDelivery(orderId);

      res.status(201).json({
        success: true,
        data: delivery,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getAllDeliveries(req: AuthRequest, res: Response) {
    try {
      const { status } = req.query;

      const deliveries = await deliveryOrchestrator.getAllDeliveries(status as DeliveryStatus);

      res.json({
        success: true,
        data: deliveries,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getDeliveryById(req: AuthRequest, res: Response) {
    try {
      const { deliveryId } = req.params;

      if (!deliveryId) {
        return res.status(400).json({
          success: false,
          message: 'Delivery ID is required',
        });
      }

      const delivery = await deliveryOrchestrator.getDeliveryById(deliveryId);

      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: 'Delivery not found',
        });
      }

      res.json({
        success: true,
        data: delivery,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateStatus(req: AuthRequest, res: Response) {
    try {
      const { deliveryId } = req.params;
      const { status, notes } = req.body;

      if (!deliveryId) {
        return res.status(400).json({
          success: false,
          message: 'Delivery ID is required',
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required',
        });
      }

      const delivery = await deliveryOrchestrator.updateStatus(
        deliveryId,
        status,
        { description: notes }
      );

      res.json({
        success: true,
        data: delivery,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}