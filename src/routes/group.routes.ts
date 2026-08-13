import { Router } from 'express';
import {
  createGroup,
  listMyGroups,
  joinGroup,
  listGroupMembers,
  updateGroup,
  deleteGroup,
} from '../controllers/group.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth.middleware';
import { GroupScopedRequest, requireGroupMembershipForResource } from '../middleware/group.middleware';
import { Group } from '../models/group.model';

const router = Router();

router.use(authenticate);

const resolveExistingGroupId = async (req: GroupScopedRequest): Promise<string | null> =>
  (await Group.exists({ _id: req.params.groupId })) ? req.params.groupId : null;

router.post('/', asyncHandler(createGroup));
router.get('/', asyncHandler(listMyGroups));
router.post('/join', asyncHandler(joinGroup));
router.get(
  '/:groupId/members',
  requireGroupMembershipForResource(resolveExistingGroupId),
  asyncHandler(listGroupMembers),
);
router.patch('/:groupId', requireGroupMembershipForResource(resolveExistingGroupId), asyncHandler(updateGroup));
router.delete('/:groupId', requireGroupMembershipForResource(resolveExistingGroupId), asyncHandler(deleteGroup));

export default router;
