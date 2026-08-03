import { Schema, model, Document } from 'mongoose';

export enum MembershipRole {
  OWNER = 'OWNER',
  MEMBER = 'MEMBER',
}

export interface IMembership extends Document {
  groupId: string;
  userId: string;
  role: MembershipRole;
  joinedAt: Date;
}

const membershipSchema = new Schema<IMembership>({
  groupId: { type: String, required: true },
  userId: { type: String, required: true },
  role: { type: String, enum: Object.values(MembershipRole), required: true, default: MembershipRole.MEMBER },
  joinedAt: { type: Date, default: Date.now },
});

membershipSchema.index({ groupId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ userId: 1 });

export const Membership = model<IMembership>('Membership', membershipSchema);
