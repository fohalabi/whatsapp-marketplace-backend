import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { FulfillmentService } from '../services/fulfillment.service';

const fulfillmentService = new FulfillmentService();

export class FulfillmentController {
    async getAllFulfillments(req: AuthRequest, res: Response) {
        try {
           const filters = {
                pickupStatus: req.query.pickupStatus as string,
                deliveryStatus: req.query.deliveryStatus as string,
                search: req.query.search as string,
                page: parseInt(req.query.page as string) || 1,
                limit: parseInt(req.query.limit as string) || 20
            };

            const result = await fulfillmentService.getAllFulFillments(filters);

            res.json({
                success: true,
                data: result
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async getDeliveryById(req: AuthRequest, res: Response) {
        try {
        const { deliveryId } = req.params;

        if (!deliveryId) {
            return res.status(400).json({
            success: false,
            message: 'Delivery ID is required'
            });
        }

        const delivery = await fulfillmentService.getDeliveryById(deliveryId);

        res.json({
            success: true,
            data: delivery
        });
        } catch (error: any) {
        res.status(404).json({
            success: false,
            message: error.message
        });
        }
    }

    // Assign rider
    async assignRider(req: AuthRequest, res: Response) {
        try {
            const { deliveryId } = req.params;
            const { riderId } = req.body;

            if (!deliveryId) {
                return res.status(400).json({
                success: false,
                message: 'Delivery ID is required'
                });
            }

            if (!riderId) {
                return res.status(400).json({
                success: false,
                message: 'Rider ID is required'
                });
            }

            const delivery = await fulfillmentService.assignRider(
                deliveryId,
                riderId,
                req.user!.userId
            );

            res.json({
                success: true,
                message: 'Rider assigned successfully',
                data: delivery
            });
            } catch (error: any) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get fulfillment stats
    async getFulfillmentStats(req: AuthRequest, res: Response) {
        try {
        const stats = await fulfillmentService.getFulfillmentStats();

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

    // Notify merchant
    async notifyMerchant(req: AuthRequest, res: Response) {
        try {
            const { deliveryId } = req.params;

            if (!deliveryId) {
            return res.status(400).json({
                success: false,
                message: 'Delivery ID is required'
            });
            }

            const result = await fulfillmentService.notifyMerchant(
            deliveryId,
            req.user!.userId
            );

            res.json({
            success: true,
            message: result.message
            });
        } catch (error: any) {
            res.status(400).json({
            success: false,
            message: error.message
            });
        }
    }
}