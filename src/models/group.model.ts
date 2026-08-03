import { randomInt } from 'crypto';
import { Schema, model, Document } from 'mongoose';

export interface IGroup extends Document {
  name: string;
  inviteCode: string;
  createdBy: string;
  createdAt: Date;
}

const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 8;

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

const groupSchema = new Schema<IGroup>({
  name: { type: String, required: true, trim: true },
  inviteCode: { type: String, required: true, unique: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Group = model<IGroup>('Group', groupSchema);
