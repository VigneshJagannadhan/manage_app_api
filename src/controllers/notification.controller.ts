import { Response } from 'express';
import { User, INotificationPreferences } from '../models/user.model';
import { Journal } from '../models/journal.model';
import { Expense } from '../models/expense.model';
import { Task, TaskStatus } from '../models/task.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const BOOLEAN_FIELDS = [
  'generalRemindersEnabled',
  'journalReminderEnabled',
  'taskReminderEnabled',
  'expenseReminderEnabled',
] as const;

const TIME_FIELDS = ['journalReminderTime', 'expenseReminderTime'] as const;

function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function combineDateAndTime(day: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hours, minutes));
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
}

export async function getPreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = await User.findById(req.userId).select('notificationPreferences');

  if (!user) {
    res.status(404).json({ message: 'user not found' });
    return;
  }

  res.status(200).json(user.notificationPreferences);
}

export async function updatePreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
  const body = req.body ?? {};
  const update: Record<string, unknown> = {};

  for (const field of BOOLEAN_FIELDS) {
    const value = body[field];
    if (value === undefined) {
      continue;
    }

    if (typeof value !== 'boolean') {
      res.status(400).json({ message: `${field} must be a boolean` });
      return;
    }

    update[`notificationPreferences.${field}`] = value;
  }

  for (const field of TIME_FIELDS) {
    const value = body[field];
    if (value === undefined) {
      continue;
    }

    if (value !== null && !TIME_REGEX.test(value)) {
      res.status(400).json({ message: `${field} must be in HH:mm 24-hour format or null` });
      return;
    }

    update[`notificationPreferences.${field}`] = value;
  }

  const user = await User.findByIdAndUpdate(
    req.userId,
    { $set: update },
    { new: true, runValidators: true },
  ).select('notificationPreferences');

  if (!user) {
    res.status(404).json({ message: 'user not found' });
    return;
  }

  res.status(200).json(user.notificationPreferences);
}

export async function getSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = await User.findById(req.userId).select('notificationPreferences');

  if (!user) {
    res.status(404).json({ message: 'user not found' });
    return;
  }

  const prefs: INotificationPreferences = user.notificationPreferences;
  const now = new Date();
  const today = startOfUTCDay(now);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const dateStr = today.toISOString().slice(0, 10);

  const notifications: Record<string, unknown>[] = [];

  if (prefs.journalReminderEnabled && prefs.journalReminderTime) {
    const scheduledAt = combineDateAndTime(today, prefs.journalReminderTime);
    if (now >= scheduledAt) {
      const alreadyJournaled = await Journal.findOne({ userId: req.userId, date: today }).select('_id').lean();
      if (!alreadyJournaled) {
        notifications.push({
          id: `journal-${dateStr}`,
          type: 'journal',
          title: "Don't forget to journal today",
          body: 'A couple of lines about your day goes a long way.',
          scheduledAt: scheduledAt.toISOString(),
          data: { date: dateStr },
        });
      }
    }
  }

  if (prefs.expenseReminderEnabled && prefs.expenseReminderTime) {
    const scheduledAt = combineDateAndTime(today, prefs.expenseReminderTime);
    if (now >= scheduledAt) {
      const alreadyLogged = await Expense.findOne({
        userId: req.userId,
        date: { $gte: today, $lt: tomorrow },
      })
        .select('_id')
        .lean();

      if (!alreadyLogged) {
        notifications.push({
          id: `expense-${dateStr}`,
          type: 'expense',
          title: "Don't forget to log today's spending",
          body: "Add today's expenses to keep your budget on track.",
          scheduledAt: scheduledAt.toISOString(),
          data: {},
        });
      }
    }
  }

  if (prefs.taskReminderEnabled) {
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tasks = await Task.find({
      $or: [{ assignedTo: req.userId }, { createdBy: req.userId }],
      status: TaskStatus.OPEN,
      dueDate: { $lte: windowEnd },
    }).lean();

    for (const task of tasks) {
      const dueDate = task.dueDate as Date;
      const scheduledAt = task.dueTime ? combineDateAndTime(startOfUTCDay(dueDate), task.dueTime) : dueDate;
      const isOverdue = scheduledAt.getTime() < now.getTime();
      const isToday = startOfUTCDay(scheduledAt).getTime() === today.getTime();

      const body = isOverdue
        ? 'Overdue'
        : isToday
          ? `Due today at ${formatTime(scheduledAt)}`
          : `Due tomorrow at ${formatTime(scheduledAt)}`;

      notifications.push({
        id: `task-${task._id}-due`,
        type: 'task',
        title: `Task due soon: ${task.title}`,
        body,
        scheduledAt: scheduledAt.toISOString(),
        data: { taskId: String(task._id), groupId: task.groupId },
      });
    }
  }

  res.status(200).json({ notifications });
}
