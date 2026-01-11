import { Request, Response, NextFunction } from 'express';
import { errorLogger, ErrorSeverity } from '../services/errorLogger.service';

const PAYSTACK_IPS = [
  '52.31.139.75',
  '52.49.173.169',
  '52.214.14.220'
];

export const paystackIPWhitelist = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const clientIP = req.ip || req.socket.remoteAddress || '';

  // Skip in development
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const isAllowed = PAYSTACK_IPS.some(ip => clientIP.includes(ip));

  if (!isAllowed) {
    await errorLogger.logError({
      service: 'PaystackWebhook',
      action: 'ipWhitelist',
      severity: ErrorSeverity.HIGH,
      error: new Error('Unauthorized IP attempted webhook access'),
      context: { clientIP, allowedIPs: PAYSTACK_IPS }
    });

    console.warn(`⚠️ Blocked webhook from unauthorized IP: ${clientIP}`);
    return res.sendStatus(403);
  }

  next();
};