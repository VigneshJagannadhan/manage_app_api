import { Schema, model, Document } from 'mongoose';

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum TaskStatus {
  OPEN = 'OPEN',
  COMPLETED = 'COMPLETED',
}

export interface ITask extends Document {
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: Date;
  dueTime?: string;
  createdAt: Date;
}

const taskSchema = new Schema<ITask>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  priority: { type: String, enum: Object.values(TaskPriority), required: true },
  status: { type: String, enum: Object.values(TaskStatus), required: true, default: TaskStatus.OPEN },
  dueDate: { type: Date, required: false },
  dueTime: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
});

export const Task = model<ITask>('Task', taskSchema);
