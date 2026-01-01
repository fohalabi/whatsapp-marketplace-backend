import { Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { WhatsAppService } from '../services/whatsapp.service';

const whatsappService = new WhatsAppService();

export class WhatsAppController {
  async sendMessage(req: AuthRequest, res: Response) {
    try {
      const { to, message } = req.body;
      
      const result = await whatsappService.sendMessage(to, message);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}