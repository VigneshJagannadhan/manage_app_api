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
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: Date;
  dueTime?: string;
  createdAt: Date;
  groupId: string;
  createdBy: string;
  assignedTo: string;
}

const taskSchema = new Schema<ITask>({
  title: { type: String, required: true },
  description: { type: String, required: false },
  priority: { type: String, enum: Object.values(TaskPriority), required: true },
  status: { type: String, enum: Object.values(TaskStatus), required: true, default: TaskStatus.OPEN },
  dueDate: { type: Date, required: false },
  dueTime: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  groupId: { type: String, required: true },
  createdBy: { type: String, required: true },
  assignedTo: { type: String, required: true },
});

taskSchema.index({ groupId: 1, createdAt: -1 });

export const Task = model<ITask>('Task', taskSchema);
