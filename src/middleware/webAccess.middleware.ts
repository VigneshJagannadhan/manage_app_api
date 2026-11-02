import { Request, Response, NextFunction } from 'express';

const HSTS_MAX_AGE_SECONDS = 15552000;

export function requireHttps(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== 'production') {
    next();
    return;
  }

  if (!req.secure) {
    res.status(403).json({ message: 'HTTPS is required' });
    return;
  }

  res.setHeader('Strict-Transport-Security', `max-age=${HSTS_MAX_AGE_SECONDS}`);
  next();
}

// Allows exactly one origin (WEB_ORIGIN). When it is not set, no CORS headers are sent at all.
export function webOriginCors(req: Request, res: Response, next: NextFunction): void {
  const allowedOrigin = process.env.WEB_ORIGIN;
  const requestOrigin = req.headers.origin;

  res.setHeader('Vary', 'Origin');

  if (allowedOrigin && requestOrigin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).send();
    return;
  }

  next();
}
