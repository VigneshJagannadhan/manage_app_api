import { Response } from 'express';
import { User, INotificationPreferences } from '../models/user.model';
import { Journal } from '../models/journal.model';
import { Expense } from '../models/expense.model';
import { Task, TaskStatus } from '../models/task.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const DEFAULT_TIME_ZONE = 'UTC';

const BOOLEAN_FIELDS = [
  'generalRemindersEnabled',
  'journalReminderEnabled',
  'taskReminderEnabled',
  'expenseReminderEnabled',
] as const;

const TIME_FIELDS = ['journalReminderTime', 'expenseReminderTime'] as const;

function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The user's local calendar day (as a UTC-midnight "day key", matching how Journal/Expense dates are stored) that `date` falls on in `timeZone`. */
function startOfDayInZone(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Converts an `HH:mm` wall-clock time on the calendar day represented by `dayKey` (a UTC-midnight day key) into the actual UTC instant it refers to in `timeZone`. */
function combineDateAndTime(dayKey: Date, time: string, timeZone: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const utcGuess = new Date(
    Date.UTC(dayKey.getUTCFullYear(), dayKey.getUTCMonth(), dayKey.getUTCDate(), hours, minutes),
  );
  // toLocaleString+timeZone strips the offset, so re-parsing it back as if it were UTC reveals
  // the current offset for that zone at this instant; apply it once to correct the guess.
  const zonedGuess = new Date(utcGuess.toLocaleString('en-US', { timeZone }));
  const offset = utcGuess.getTime() - zonedGuess.getTime();
  return new Date(utcGuess.getTime() + offset);
}

function formatTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone });
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

  if (body.timezone !== undefined) {
    const value = body.timezone;
    if (value !== null && (typeof value !== 'string' || !isValidTimeZone(value))) {
      res.status(400).json({ message: 'timezone must be a valid IANA time zone name or null' });
      return;
    }
    update['notificationPreferences.timezone'] = value;
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
  const timeZone = prefs.timezone && isValidTimeZone(prefs.timezone) ? prefs.timezone : DEFAULT_TIME_ZONE;
  const now = new Date();
  const today = startOfDayInZone(now, timeZone);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const dateStr = today.toISOString().slice(0, 10);

  const notifications: Record<string, unknown>[] = [];

  // Note: deliberately no "now >= scheduledAt" gate here. The client only ever schedules a
  // *future* local notification (flutter_local_notifications needs a future instant) - gating
  // on "already due" here meant scheduledAt was always in the past by the time the client saw
  // it, so it could never actually be scheduled ahead of time. Handing back today's reminder
  // time as soon as it's known (even hours ahead) lets the client schedule it correctly.
  if (prefs.journalReminderEnabled && prefs.journalReminderTime) {
    const scheduledAt = combineDateAndTime(today, prefs.journalReminderTime, timeZone);
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

  if (prefs.expenseReminderEnabled && prefs.expenseReminderTime) {
    const scheduledAt = combineDateAndTime(today, prefs.expenseReminderTime, timeZone);
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

  if (prefs.taskReminderEnabled) {
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tasks = await Task.find({
      $or: [{ assignedTo: req.userId }, { createdBy: req.userId }],
      status: TaskStatus.OPEN,
      dueDate: { $lte: windowEnd },
    }).lean();

    for (const task of tasks) {
      const dueDate = task.dueDate as Date;
      const scheduledAt = task.dueTime
        ? combineDateAndTime(startOfDayInZone(dueDate, timeZone), task.dueTime, timeZone)
        : dueDate;
      const isOverdue = scheduledAt.getTime() < now.getTime();
      const isToday = startOfDayInZone(scheduledAt, timeZone).getTime() === today.getTime();

      const body = isOverdue
        ? 'Overdue'
        : isToday
          ? `Due today at ${formatTime(scheduledAt, timeZone)}`
          : `Due tomorrow at ${formatTime(scheduledAt, timeZone)}`;

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
