import { Router } from 'express';
import { createExpense, listExpenses, updateExpense, deleteExpense } from '../controllers/expense.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth.middleware';
import { requireGroupMembership, requireGroupMembershipForResource } from '../middleware/group.middleware';
import { Expense } from '../models/expense.model';

const router = Router();

router.use(authenticate);

const requireExpenseGroupMembership = requireGroupMembershipForResource(async (req) => {
  const expense = await Expense.findById(req.params.id).select('groupId').lean();
  return expense?.groupId ?? null;
});

router.post('/', requireGroupMembership, asyncHandler(createExpense));
router.get('/', asyncHandler(listExpenses));
router.patch('/:id', requireExpenseGroupMembership, asyncHandler(updateExpense));
router.delete('/:id', requireExpenseGroupMembership, asyncHandler(deleteExpense));

export default router;
