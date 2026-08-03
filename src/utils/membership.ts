import { Membership } from '../models/membership.model';

export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const membership = await Membership.findOne({ groupId, userId }).lean();
  return membership !== null;
}

export async function getUserGroupIds(userId: string): Promise<string[]> {
  const memberships = await Membership.find({ userId }).select('groupId').lean();
  return memberships.map((membership) => membership.groupId);
}

export async function getGroupMemberIds(groupId: string): Promise<string[]> {
  const memberships = await Membership.find({ groupId }).select('userId').lean();
  return memberships.map((membership) => membership.userId);
}

export async function areAllGroupMembers(groupId: string, userIds: string[]): Promise<boolean> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) {
    return true;
  }

  const count = await Membership.countDocuments({ groupId, userId: { $in: uniqueIds } });
  return count === uniqueIds.length;
}
