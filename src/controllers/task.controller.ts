import { Request, Response } from 'express';
import { Task, TaskPriority, TaskStatus } from '../models/task.model';

const DUE_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidDueTime(dueTime: unknown): dueTime is string {
  return typeof dueTime === 'string' && DUE_TIME_REGEX.test(dueTime);
}

export async function createTask(req: Request, res: Response): Promise<void> {
  const { title, description, priority, status, createdAt, dueDate, dueTime } = req.body;

  if (!title || !description || !priority) {
    res.status(400).json({ message: 'title, description and priority are required' });
    return;
  }

  if (!Object.values(TaskPriority).includes(priority)) {
    res.status(400).json({ message: `priority must be one of ${Object.values(TaskPriority).join(', ')}` });
    return;
  }

  if (status !== undefined && !Object.values(TaskStatus).includes(status)) {
    res.status(400).json({ message: `status must be one of ${Object.values(TaskStatus).join(', ')}` });
    return;
  }

  if (dueTime !== undefined && !isValidDueTime(dueTime)) {
    res.status(400).json({ message: 'dueTime must be in HH:mm 24-hour format' });
    return;
  }

  const task = await Task.create({
    title,
    description,
    priority,
    ...(status ? { status } : {}),
    ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
    ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
    ...(dueTime ? { dueTime } : {}),
  });

  res.status(201).json(task);
}

export async function listTasks(req: Request, res: Response): Promise<void> {
  const { status } = req.query;

  if (status !== undefined && !Object.values(TaskStatus).includes(status as TaskStatus)) {
    res.status(400).json({ message: `status must be one of ${Object.values(TaskStatus).join(', ')}` });
    return;
  }

  const filter = {
    ...(status !== undefined ? { status } : {}),
  };

  const tasks = await Task.find(filter).sort({ createdAt: -1 });
  res.status(200).json(tasks);
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { title, description, priority, status, createdAt, dueDate, dueTime } = req.body;

  if (priority && !Object.values(TaskPriority).includes(priority)) {
    res.status(400).json({ message: `priority must be one of ${Object.values(TaskPriority).join(', ')}` });
    return;
  }

  if (status && !Object.values(TaskStatus).includes(status)) {
    res.status(400).json({ message: `status must be one of ${Object.values(TaskStatus).join(', ')}` });
    return;
  }

  if (dueTime !== undefined && dueTime !== null && !isValidDueTime(dueTime)) {
    res.status(400).json({ message: 'dueTime must be in HH:mm 24-hour format' });
    return;
  }

  const update = {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(createdAt !== undefined ? { createdAt: new Date(createdAt) } : {}),
    ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
    ...(dueTime !== undefined ? { dueTime: dueTime || null } : {}),
  };

  const task = await Task.findByIdAndUpdate(id, update, { new: true, runValidators: true });

  if (!task) {
    res.status(404).json({ message: 'task not found' });
    return;
  }

  res.status(200).json(task);
}

export async function deleteTask(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const task = await Task.findByIdAndDelete(id);

  if (!task) {
    res.status(404).json({ message: 'task not found' });
    return;
  }

  res.status(204).send();
}
