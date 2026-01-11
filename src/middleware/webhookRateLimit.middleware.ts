import rateLimit from 'express-rate-limit';

export const webhookRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Max 100 requests per minute per IP
  message: 'Too many webhook requests',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Rate limit exceeded from IP: ${req.ip}`);
    res.status(429).json({ error: 'Too many requests' });
  }
});