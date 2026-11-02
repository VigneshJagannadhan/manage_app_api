import { createHash } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { RateLimit } from '../models/rateLimit.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { normalizeIdentifier } from './identifier';

interface LimiterOptions {
  scope: string;
  max: number;
  windowMs: number;
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

function hashKey(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function consume(key: string, windowMs: number, attempt = 0): Promise<{ count: number; expiresAt: Date }> {
  const now = new Date();

  // The TTL monitor only runs about once a minute, so expired windows are cleared here too.
  await RateLimit.deleteOne({ key, expiresAt: { $lte: now } });

  try {
    const entry = await RateLimit.findOneAndUpdate(
      { key },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + windowMs) } },
      { upsert: true, new: true },
    );
    return { count: entry.count, expiresAt: entry.expiresAt };
  } catch (err) {
    if (isDuplicateKeyError(err) && attempt < 1) {
      return consume(key, windowMs, attempt + 1);
    }
    throw err;
  }
}

function createLimiter(options: LimiterOptions, resolveKey: (req: Request) => string | null) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawKey = resolveKey(req);
      if (!rawKey) {
        next();
        return;
      }

      const { count, expiresAt } = await consume(`${options.scope}:${hashKey(rawKey)}`, options.windowMs);

      if (count > options.max) {
        const retryAfterSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
        res.setHeader('Retry-After', String(retryAfterSeconds));
        res.status(429).json({ message: 'Too many attempts. Please try again later.' });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export const WEB_DELETE_IP_LIMIT = { scope: 'web-delete-ip', max: 10, windowMs: 15 * 60 * 1000 };
export const WEB_DELETE_IDENTIFIER_LIMIT = { scope: 'web-delete-identifier', max: 5, windowMs: 60 * 60 * 1000 };
export const APP_DELETE_USER_LIMIT = { scope: 'app-delete-user', max: 5, windowMs: 60 * 60 * 1000 };

export const webDeleteIpLimiter = createLimiter(WEB_DELETE_IP_LIMIT, (req) => req.ip ?? 'unknown');

export const webDeleteIdentifierLimiter = createLimiter(WEB_DELETE_IDENTIFIER_LIMIT, (req) => {
  const identifier = normalizeIdentifier(req.body?.identifier);
  return identifier ? `${identifier.type}:${identifier.value}` : null;
});

export const appDeleteUserLimiter = createLimiter(
  APP_DELETE_USER_LIMIT,
  (req) => (req as AuthenticatedRequest).userId ?? null,
);
