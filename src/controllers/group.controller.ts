import { Response } from 'express';
import { Group, generateInviteCode } from '../models/group.model';
import { Membership, MembershipRole } from '../models/membership.model';
import { User } from '../models/user.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { GroupScopedRequest } from '../middleware/group.middleware';

const MAX_INVITE_CODE_ATTEMPTS = 5;

interface MongoDuplicateKeyError {
  code?: number;
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as MongoDuplicateKeyError).code === 11000;
}

export async function createGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name } = req.body;

  if (name !== undefined && typeof name !== 'string') {
    res.status(400).json({ message: 'name must be a string' });
    return;
  }

  if (!name || !name.trim()) {
    res.status(422).json({ message: 'name is required' });
    return;
  }

  let group;
  for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt++) {
    try {
      group = await Group.create({ name, inviteCode: generateInviteCode(), createdBy: req.userId });
      break;
    } catch (err) {
      if (!isDuplicateKeyError(err) || attempt === MAX_INVITE_CODE_ATTEMPTS - 1) {
        throw err;
      }
    }
  }

  await Membership.create({ groupId: group!.id, userId: req.userId, role: MembershipRole.OWNER });

  res.status(201).json(group);
}

export async function listMyGroups(req: AuthenticatedRequest, res: Response): Promise<void> {
  const memberships = await Membership.find({ userId: req.userId }).lean();
  const groupIds = memberships.map((membership) => membership.groupId);
  const roleByGroupId = new Map(memberships.map((membership) => [membership.groupId, membership.role]));

  const groups = await Group.find({ _id: { $in: groupIds } }).sort({ createdAt: -1 });

  res.status(200).json(
    groups.map((group) => ({
      ...group.toObject(),
      role: roleByGroupId.get(group.id),
    })),
  );
}

export async function joinGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { inviteCode } = req.body;

  if (!inviteCode || typeof inviteCode !== 'string') {
    res.status(400).json({ message: 'inviteCode is required' });
    return;
  }

  const group = await Group.findOne({ inviteCode: inviteCode.trim().toUpperCase() });

  if (!group) {
    res.status(404).json({ message: 'invalid invite code' });
    return;
  }

  if (await Membership.findOne({ groupId: group.id, userId: req.userId })) {
    res.status(409).json({ message: 'already a member of this group' });
    return;
  }

  try {
    const membership = await Membership.create({
      groupId: group.id,
      userId: req.userId,
      role: MembershipRole.MEMBER,
    });
    res.status(201).json({ group, membership });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      res.status(409).json({ message: 'already a member of this group' });
      return;
    }
    throw err;
  }
}

export async function listGroupMembers(req: GroupScopedRequest, res: Response): Promise<void> {
  const memberships = await Membership.find({ groupId: req.params.groupId }).lean();
  const userIds = memberships.map((membership) => membership.userId);

  const users = await User.find({ _id: { $in: userIds } }).select('name email');
  const userById = new Map(users.map((user) => [user.id, user]));

  res.status(200).json(
    memberships.map((membership) => ({
      userId: membership.userId,
      name: userById.get(membership.userId)?.name,
      email: userById.get(membership.userId)?.email,
      role: membership.role,
      joinedAt: membership.joinedAt,
    })),
  );
}
