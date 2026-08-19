import { Schema, model, Document } from 'mongoose';

export interface IJournal extends Document {
  userId: string;
  date: Date;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const journalSchema = new Schema<IJournal>(
  {
    userId: { type: String, required: true },
    date: { type: Date, required: true },
    content: { type: String, required: true },
  },
  { timestamps: true },
);

journalSchema.index({ userId: 1, date: 1 }, { unique: true });

export const Journal = model<IJournal>('Journal', journalSchema);
