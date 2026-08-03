import { Router } from 'express';
import { createGroup, listMyGroups, joinGroup, listGroupMembers } from '../controllers/group.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth.middleware';
import { requireGroupMembershipForResource } from '../middleware/group.middleware';
import { Group } from '../models/group.model';

const router = Router();

router.use(authenticate);

router.post('/', asyncHandler(createGroup));
router.get('/', asyncHandler(listMyGroups));
router.post('/join', asyncHandler(joinGroup));
router.get(
  '/:groupId/members',
  requireGroupMembershipForResource(async (req) =>
    (await Group.exists({ _id: req.params.groupId })) ? req.params.groupId : null,
  ),
  asyncHandler(listGroupMembers),
);

export default router;
