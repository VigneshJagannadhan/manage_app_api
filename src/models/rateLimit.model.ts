import { Schema, model, Document } from 'mongoose';

export interface IRateLimit extends Document {
  key: string;
  count: number;
  expiresAt: Date;
}

const rateLimitSchema = new Schema<IRateLimit>({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export const RateLimit = model<IRateLimit>('RateLimit', rateLimitSchema);
