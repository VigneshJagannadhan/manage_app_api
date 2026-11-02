import mongoose, { ClientSession } from 'mongoose';
import { User } from '../models/user.model';
import { Group } from '../models/group.model';
import { Membership, MembershipRole } from '../models/membership.model';
import { Task } from '../models/task.model';
import { Expense } from '../models/expense.model';
import { Journal } from '../models/journal.model';
import { AuditLog, AuditAction, AuditSource } from '../models/auditLog.model';

// Replaces the deleted user's id on expenses that other members created, so their balances stay intact.
export const DELETED_USER_ID = 'deleted-user';

async function handleOwnedGroups(userId: string, session: ClientSession): Promise<void> {
  const ownedMemberships = await Membership.find({ userId, role: MembershipRole.OWNER }).session(session);

  for (const ownership of ownedMemberships) {
    const { groupId } = ownership;
    const otherMembers = await Membership.find({ groupId, userId: { $ne: userId } })
      .sort({ joinedAt: 1, _id: 1 })
      .session(session);

    if (otherMembers.length === 0) {
      await Promise.all([
        Group.deleteOne({ _id: groupId }, { session }),
        Membership.deleteMany({ groupId }, { session }),
        Task.deleteMany({ groupId }, { session }),
        Expense.deleteMany({ groupId }, { session }),
        User.updateMany({ defaultGroupId: groupId }, { $unset: { defaultGroupId: '' } }, { session }),
      ]);
      continue;
    }

    const nextOwner = otherMembers.find((member) => member.role === MembershipRole.OWNER) ?? otherMembers[0];

    if (nextOwner.role !== MembershipRole.OWNER) {
      await Membership.updateOne({ _id: nextOwner._id }, { role: MembershipRole.OWNER }, { session });
    }
    await Group.updateOne({ _id: groupId }, { createdBy: nextOwner.userId }, { session });
  }
}

async function removeUserContributions(userId: string, session: ClientSession): Promise<void> {
  await Task.updateMany(
    { assignedTo: userId, createdBy: { $ne: userId } },
    [{ $set: { assignedTo: '$createdBy' } }],
    { session },
  );
  await Task.deleteMany({ createdBy: userId }, { session });

  await Expense.deleteMany({ userId }, { session });
  await Expense.updateMany({ 'payer.userId': userId }, { $set: { 'payer.userId': DELETED_USER_ID } }, { session });
  await Expense.updateMany(
    { 'splits.userId': userId },
    { $set: { 'splits.$[split].userId': DELETED_USER_ID } },
    { session, arrayFilters: [{ 'split.userId': userId }] },
  );
}

/**
 * Deletes a user and everything they own in a single transaction.
 * Returns false (and does nothing) when the user no longer exists.
 * The refresh token lives on the user document, so it is revoked with it.
 */
export async function deleteUserAccount(userId: string, source: AuditSource): Promise<boolean> {
  if (!mongoose.isValidObjectId(userId)) {
    return false;
  }

  const session = await mongoose.startSession();
  let deleted = false;

  try {
    await session.withTransaction(async () => {
      deleted = false;

      if (!(await User.exists({ _id: userId }).session(session))) {
        return;
      }

      await handleOwnedGroups(userId, session);
      await removeUserContributions(userId, session);
      await Promise.all([
        Membership.deleteMany({ userId }, { session }),
        Journal.deleteMany({ userId }, { session }),
      ]);
      await User.deleteOne({ _id: userId }, { session });
      await AuditLog.create([{ action: AuditAction.ACCOUNT_DELETED, userId, source }], { session });

      deleted = true;
    });
  } finally {
    await session.endSession();
  }

  return deleted;
}
