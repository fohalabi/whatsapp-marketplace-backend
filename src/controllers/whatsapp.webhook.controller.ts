import { Request, Response } from 'express';
import prisma from '../config/database';

export class WhatsAppWebhookController {
  // Verify webhook (Meta will call this during setup)
  verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'your_verify_token';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified!');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }

  // Receive incoming messages
   async receiveMessage(req: Request, res: Response) {
    try {
      const body = req.body;
      
      // Acknowledge receipt immediately
      res.sendStatus(200);

      // Check if it's a message event
      if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from; // Customer phone number
        const messageId = message.id;
        const text = message.text?.body || '';

        // Save to database
        await prisma.customerMessage.create({
          data: {
            messageId,
            from,
            message: text,
          },
        });

        console.log('Message saved:', { from, text });
      }
    } catch (error) {
      console.error('Webhook error:', error);
    }
  }
}