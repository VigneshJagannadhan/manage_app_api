import { Schema, model, Document } from 'mongoose';

export enum AuditAction {
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
}

export enum AuditSource {
  APP = 'app',
  WEB = 'web',
}

export interface IAuditLog extends Document {
  action: AuditAction;
  userId: string;
  source: AuditSource;
  createdAt: Date;
}

const DEFAULT_RETENTION_DAYS = 365;
const retentionDays = Number(process.env.AUDIT_LOG_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS;

const auditLogSchema = new Schema<IAuditLog>({
  action: { type: String, enum: Object.values(AuditAction), required: true },
  userId: { type: String, required: true },
  source: { type: String, enum: Object.values(AuditSource), required: true },
  createdAt: { type: Date, default: Date.now, expires: retentionDays * 24 * 60 * 60 },
});

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
