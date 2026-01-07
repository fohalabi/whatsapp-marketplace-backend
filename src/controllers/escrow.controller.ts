import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import prisma from '../config/database';

export class EscrowController {
  async getAllEscrow(req: AuthRequest, res: Response) {
    try {
      const escrows = await prisma.escrow.findMany({
        where: { status: 'HELD' },
        include: {
          order: {
            include: {
              items: {
                include: { product: true },
              },
            },
          },
        },
        orderBy: { heldAt: 'desc' },
      });

      // Calculate days in escrow
      const now = new Date();
      const escrowData = escrows.map(escrow => {
        const daysInEscrow = Math.floor(
          (now.getTime() - escrow.heldAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        return {
          ...escrow,
          daysInEscrow,
        };
      });

      res.json({
        success: true,
        data: escrowData,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getEscrowStats(req: AuthRequest, res: Response) {
    try {
      const escrows = await prisma.escrow.findMany({
        where: { status: 'HELD' },
      });

      const totalInEscrow = escrows.reduce((sum, e) => sum + e.amount, 0);
      const ordersInEscrow = escrows.length;

      const now = new Date();
      const oldestEscrow = escrows.length > 0
        ? Math.max(...escrows.map(e => 
            Math.floor((now.getTime() - e.heldAt.getTime()) / (1000 * 60 * 60 * 24))
          ))
        : 0;

      res.json({
        success: true,
        data: {
          totalInEscrow,
          ordersInEscrow,
          oldestEscrow,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}