import { Request, Response } from 'express';
import mongoose from 'mongoose';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const dbConnected = mongoose.connection.readyState === 1;

  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    db: dbConnected ? 'connected' : 'disconnected',
  });
}
