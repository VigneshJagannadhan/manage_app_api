import { Router } from 'express';
import { createTask, listTasks, updateTask, deleteTask } from '../controllers/task.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', asyncHandler(createTask));
router.get('/', asyncHandler(listTasks));
router.patch('/:id', asyncHandler(updateTask));
router.delete('/:id', asyncHandler(deleteTask));

export default router;
