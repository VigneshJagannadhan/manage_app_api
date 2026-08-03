import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { isGroupMember } from '../utils/membership';
import { asyncHandler } from '../utils/asyncHandler';

export interface GroupScopedRequest extends AuthenticatedRequest {
  groupId?: string;
}

export const requireGroupMembership = asyncHandler(async (req: GroupScopedRequest, res: Response, next: NextFunction) => {
  const { groupId } = req.body;

  if (!groupId || typeof groupId !== 'string') {
    res.status(400).json({ message: 'groupId is required' });
    return;
  }

  if (!(await isGroupMember(groupId, req.userId as string))) {
    res.status(403).json({ message: 'you are not a member of this group' });
    return;
  }

  req.groupId = groupId;
  next();
});

export function requireGroupMembershipForResource(
  resolveGroupId: (req: GroupScopedRequest) => Promise<string | null>,
) {
  return asyncHandler(async (req: GroupScopedRequest, res: Response, next: NextFunction) => {
    const groupId = await resolveGroupId(req);

    if (!groupId) {
      res.status(404).json({ message: 'resource not found' });
      return;
    }

    if (!(await isGroupMember(groupId, req.userId as string))) {
      res.status(403).json({ message: 'you are not a member of this group' });
      return;
    }

    req.groupId = groupId;
    next();
  });
}
