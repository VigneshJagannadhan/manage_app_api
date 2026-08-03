import { Router } from 'express';
import { createExpense, listExpenses, updateExpense, deleteExpense } from '../controllers/expense.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', asyncHandler(createExpense));
router.get('/', asyncHandler(listExpenses));
router.patch('/:id', asyncHandler(updateExpense));
router.delete('/:id', asyncHandler(deleteExpense));

export default router;
