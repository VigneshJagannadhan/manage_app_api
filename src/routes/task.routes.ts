import { Router } from 'express';
import { createTask, listTasks, updateTask, deleteTask } from '../controllers/task.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth.middleware';
import { requireGroupMembership, requireGroupMembershipForResource } from '../middleware/group.middleware';
import { Task } from '../models/task.model';

const router = Router();

router.use(authenticate);

const requireTaskGroupMembership = requireGroupMembershipForResource(async (req) => {
  const task = await Task.findById(req.params.id).select('groupId').lean();
  return task?.groupId ?? null;
});

router.post('/', requireGroupMembership, asyncHandler(createTask));
router.get('/', asyncHandler(listTasks));
router.patch('/:id', requireTaskGroupMembership, asyncHandler(updateTask));
router.delete('/:id', requireTaskGroupMembership, asyncHandler(deleteTask));

export default router;
