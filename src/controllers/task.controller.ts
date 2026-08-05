import { Response } from 'express';
import { Task, TaskPriority, TaskStatus } from '../models/task.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { GroupScopedRequest } from '../middleware/group.middleware';
import { areAllGroupMembers, getUserGroupIds, isGroupMember } from '../utils/membership';

const DUE_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidDueTime(dueTime: unknown): dueTime is string {
  return typeof dueTime === 'string' && DUE_TIME_REGEX.test(dueTime);
}

export async function createTask(req: GroupScopedRequest, res: Response): Promise<void> {
  const { title, description, priority, status, createdAt, dueDate, dueTime, assignedTo } = req.body;
  const groupId = req.groupId as string;

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

  if (assignedTo !== undefined && typeof assignedTo !== 'string') {
    res.status(400).json({ message: 'assignedTo must be a string' });
    return;
  }

  const resolvedAssignee = assignedTo || (req.userId as string);

  if (assignedTo && !(await areAllGroupMembers(groupId, [assignedTo]))) {
    res.status(422).json({ message: 'assignedTo must be a member of this group' });
    return;
  }

  const task = await Task.create({
    title,
    description,
    priority,
    groupId,
    createdBy: req.userId,
    assignedTo: resolvedAssignee,
    ...(status ? { status } : {}),
    ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
    ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
    ...(dueTime ? { dueTime } : {}),
  });

  res.status(201).json(task);
}

export async function listTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { status, groupId } = req.query;

  if (status !== undefined && !Object.values(TaskStatus).includes(status as TaskStatus)) {
    res.status(400).json({ message: `status must be one of ${Object.values(TaskStatus).join(', ')}` });
    return;
  }

  if (groupId !== undefined && typeof groupId !== 'string') {
    res.status(400).json({ message: 'groupId must be a string' });
    return;
  }

  let groupFilter: Record<string, unknown>;
  if (groupId !== undefined) {
    if (!(await isGroupMember(groupId, req.userId as string))) {
      res.status(403).json({ message: 'you are not a member of this group' });
      return;
    }
    groupFilter = { groupId };
  } else {
    groupFilter = { groupId: { $in: await getUserGroupIds(req.userId as string) } };
  }

  const filter = {
    ...groupFilter,
    $or: [{ assignedTo: req.userId }, { createdBy: req.userId }],
    ...(status !== undefined ? { status } : {}),
  };

  const tasks = await Task.find(filter).sort({ createdAt: -1 });
  res.status(200).json(tasks);
}

export async function updateTask(req: GroupScopedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { title, description, priority, status, createdAt, dueDate, dueTime, assignedTo } = req.body;
  const groupId = req.groupId as string;

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

  if (assignedTo !== undefined && typeof assignedTo !== 'string') {
    res.status(400).json({ message: 'assignedTo must be a string' });
    return;
  }

  if (assignedTo && !(await areAllGroupMembers(groupId, [assignedTo]))) {
    res.status(422).json({ message: 'assignedTo must be a member of this group' });
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
    ...(assignedTo !== undefined ? { assignedTo } : {}),
  };

  const task = await Task.findOneAndUpdate(
    { _id: id, groupId, $or: [{ assignedTo: req.userId }, { createdBy: req.userId }] },
    update,
    { new: true, runValidators: true },
  );

  if (!task) {
    res.status(404).json({ message: 'task not found' });
    return;
  }

  res.status(200).json(task);
}

export async function deleteTask(req: GroupScopedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const task = await Task.findOneAndDelete({
    _id: id,
    groupId: req.groupId,
    $or: [{ assignedTo: req.userId }, { createdBy: req.userId }],
  });

  if (!task) {
    res.status(404).json({ message: 'task not found' });
    return;
  }

  res.status(204).send();
}
