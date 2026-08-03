import { Response } from 'express';
import { Expense, ExpenseCategory, IExpensePayer, IExpenseSplit } from '../models/expense.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { GroupScopedRequest } from '../middleware/group.middleware';
import { areAllGroupMembers, getUserGroupIds, isGroupMember } from '../utils/membership';

function isValidCategory(category: unknown): category is ExpenseCategory {
  return typeof category === 'string' && Object.values(ExpenseCategory).includes(category as ExpenseCategory);
}

function isValidPayer(payer: unknown): boolean {
  if (payer === undefined) {
    return true;
  }

  if (typeof payer !== 'object' || payer === null || Array.isArray(payer)) {
    return false;
  }

  const { userId } = payer as IExpensePayer;
  return typeof userId === 'string' && userId.length > 0;
}

function isValidSplits(splits: unknown): boolean {
  if (splits === undefined) {
    return true;
  }

  if (!Array.isArray(splits)) {
    return false;
  }

  return splits.every((split) => {
    if (typeof split !== 'object' || split === null) {
      return false;
    }

    const { userId, amountOwed } = split as IExpenseSplit;
    return typeof userId === 'string' && userId.length > 0 && typeof amountOwed === 'number';
  });
}

export async function createExpense(req: GroupScopedRequest, res: Response): Promise<void> {
  const { title, amount, category, date, payer, splits } = req.body;
  const groupId = req.groupId as string;

  if (title !== undefined && typeof title !== 'string') {
    res.status(400).json({ message: 'title must be a string' });
    return;
  }

  if (!title || !title.trim()) {
    res.status(422).json({ message: 'title is required' });
    return;
  }

  if (amount !== undefined && typeof amount !== 'number') {
    res.status(400).json({ message: 'amount must be a number' });
    return;
  }

  if (amount === undefined || amount <= 0) {
    res.status(422).json({ message: 'amount must be a number greater than 0' });
    return;
  }

  if (category !== undefined && typeof category !== 'string') {
    res.status(400).json({ message: 'category must be a string' });
    return;
  }

  if (!isValidCategory(category)) {
    res.status(422).json({ message: `category must be one of ${Object.values(ExpenseCategory).join(', ')}` });
    return;
  }

  if (date !== undefined && typeof date !== 'string' && !(date instanceof Date)) {
    res.status(400).json({ message: 'date must be a valid date string' });
    return;
  }

  if (date === undefined) {
    res.status(422).json({ message: 'date is required' });
    return;
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    res.status(422).json({ message: 'date must be a valid date' });
    return;
  }

  if (!isValidPayer(payer)) {
    res.status(400).json({ message: 'payer must be an object with a string or null contactId' });
    return;
  }

  if (!isValidSplits(splits)) {
    res.status(400).json({ message: 'splits must be an array of { userId, amountOwed } entries' });
    return;
  }

  const resolvedPayer: IExpensePayer = payer ?? { userId: req.userId as string };
  const resolvedSplits: IExpenseSplit[] = splits ?? [];

  const membersToCheck = [resolvedPayer.userId, ...resolvedSplits.map((split) => split.userId)];
  if (!(await areAllGroupMembers(groupId, membersToCheck))) {
    res.status(422).json({ message: 'payer and all splits must reference members of this group' });
    return;
  }

  const expense = await Expense.create({
    title,
    amount,
    category,
    date: parsedDate,
    groupId,
    userId: req.userId,
    payer: resolvedPayer,
    splits: resolvedSplits,
  });

  res.status(201).json(expense);
}

export async function listExpenses(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { category, groupId } = req.query;

  if (category !== undefined && !isValidCategory(category)) {
    res.status(400).json({ message: `category must be one of ${Object.values(ExpenseCategory).join(', ')}` });
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
    ...(category !== undefined ? { category } : {}),
  };

  const expenses = await Expense.find(filter).sort({ createdAt: -1 });
  res.status(200).json(expenses);
}

export async function updateExpense(req: GroupScopedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { title, amount, category, date } = req.body;
  const groupId = req.groupId;

  if (title !== undefined && typeof title !== 'string') {
    res.status(400).json({ message: 'title must be a string' });
    return;
  }

  if (title !== undefined && !title.trim()) {
    res.status(422).json({ message: 'title is required' });
    return;
  }

  if (amount !== undefined && typeof amount !== 'number') {
    res.status(400).json({ message: 'amount must be a number' });
    return;
  }

  if (amount !== undefined && amount <= 0) {
    res.status(422).json({ message: 'amount must be a number greater than 0' });
    return;
  }

  if (category !== undefined && typeof category !== 'string') {
    res.status(400).json({ message: 'category must be a string' });
    return;
  }

  if (category !== undefined && !isValidCategory(category)) {
    res.status(422).json({ message: `category must be one of ${Object.values(ExpenseCategory).join(', ')}` });
    return;
  }

  if (date !== undefined && typeof date !== 'string' && !(date instanceof Date)) {
    res.status(400).json({ message: 'date must be a valid date string' });
    return;
  }

  let parsedDate: Date | undefined;
  if (date !== undefined) {
    parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      res.status(422).json({ message: 'date must be a valid date' });
      return;
    }
  }

  const update = {
    ...(title !== undefined ? { title } : {}),
    ...(amount !== undefined ? { amount } : {}),
    ...(category !== undefined ? { category } : {}),
    ...(parsedDate !== undefined ? { date: parsedDate } : {}),
  };

  const expense = await Expense.findOneAndUpdate({ _id: id, groupId }, update, {
    new: true,
    runValidators: true,
  });

  if (!expense) {
    res.status(404).json({ message: 'expense not found' });
    return;
  }

  res.status(200).json(expense);
}

export async function deleteExpense(req: GroupScopedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const expense = await Expense.findOneAndDelete({ _id: id, groupId: req.groupId });

  if (!expense) {
    res.status(404).json({ message: 'expense not found' });
    return;
  }

  res.status(204).send();
}
