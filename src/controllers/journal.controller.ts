import { Response } from 'express';
import { Journal } from '../models/journal.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

function parseCalendarDay(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return date;
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function listJournals(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { from, to } = req.query;

  const fromDate = parseCalendarDay(from);
  const toDate = parseCalendarDay(to);

  if (!fromDate || !toDate) {
    res.status(400).json({ message: 'from and to must be valid date strings' });
    return;
  }

  const journals = await Journal.find({
    userId: req.userId,
    date: { $gte: fromDate, $lte: toDate },
  });

  res.status(200).json(journals);
}

export async function upsertJournal(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { date, content } = req.body;

  const day = parseCalendarDay(date);
  if (!day) {
    res.status(400).json({ message: 'date must be a valid date string' });
    return;
  }

  if (typeof content !== 'string') {
    res.status(400).json({ message: 'content must be a string' });
    return;
  }

  if (day.getTime() > startOfTodayUTC().getTime()) {
    res.status(400).json({ message: 'date cannot be in the future' });
    return;
  }

  const journal = await Journal.findOneAndUpdate(
    { userId: req.userId, date: day },
    { userId: req.userId, date: day, content },
    { new: true, upsert: true, runValidators: true },
  );

  res.status(200).json(journal);
}
