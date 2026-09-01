import { Schema, model, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface INotificationPreferences {
  generalRemindersEnabled: boolean;
  journalReminderEnabled: boolean;
  taskReminderEnabled: boolean;
  expenseReminderEnabled: boolean;
  journalReminderTime: string | null;
  expenseReminderTime: string | null;
  timezone: string | null;
}

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  phone?: string;
  refreshToken?: string;
  defaultGroupId?: string;
  notificationPreferences: INotificationPreferences;
  createdAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const notificationPreferencesSchema = new Schema<INotificationPreferences>(
  {
    generalRemindersEnabled: { type: Boolean, required: true, default: true },
    journalReminderEnabled: { type: Boolean, required: true, default: true },
    taskReminderEnabled: { type: Boolean, required: true, default: true },
    expenseReminderEnabled: { type: Boolean, required: true, default: true },
    journalReminderTime: { type: String, required: false, default: '20:00' },
    expenseReminderTime: { type: String, required: false, default: '21:00' },
    timezone: { type: String, required: false, default: null },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  phone: { type: String, required: false, trim: true },
  refreshToken: { type: String, required: false, select: false },
  defaultGroupId: { type: String, required: false },
  notificationPreferences: { type: notificationPreferencesSchema, required: true, default: () => ({}) },
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const User = model<IUser>('User', userSchema);
