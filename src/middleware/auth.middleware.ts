import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { User } from '../models/user.model';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: 'authorization header missing or malformed' });
    return;
  }

  const token = header.slice('Bearer '.length);

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    res.status(401).json({ message: 'invalid or expired access token' });
    return;
  }

  try {
    // Access tokens are stateless, so a deleted account is rejected here instead of waiting for expiry.
    if (!(await User.exists({ _id: payload.sub }))) {
      res.status(401).json({ message: 'invalid or expired access token' });
      return;
    }
  } catch (err) {
    next(err);
    return;
  }

  req.userId = payload.sub;
  req.userEmail = payload.email;
  next();
}
