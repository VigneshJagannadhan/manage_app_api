import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, IUser } from '../models/user.model';
import { AuditSource } from '../models/auditLog.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { deleteUserAccount } from '../services/account.service';
import { normalizeIdentifier } from '../utils/identifier';

const DELETE_CONFIRMATION = 'DELETE';
const MAX_PASSWORD_LENGTH = 128;
const MAX_PHONE_MATCHES = 5;
const INVALID_CREDENTIALS = { message: 'Invalid credentials' };

// Compared against when no account matches, so a miss costs the same as a wrong password.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

function isValidPasswordInput(password: unknown): password is string {
  return typeof password === 'string' && password.length > 0 && password.length <= MAX_PASSWORD_LENGTH;
}

export async function deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { password } = req.body ?? {};

  if (!isValidPasswordInput(password)) {
    res.status(400).json({ message: 'password is required' });
    return;
  }

  const user = await User.findById(req.userId);

  if (!user || !(await user.comparePassword(password))) {
    res.status(403).json(INVALID_CREDENTIALS);
    return;
  }

  await deleteUserAccount(user.id, AuditSource.APP);

  res.status(200).json({ message: 'Account deleted' });
}

async function findCandidates(type: 'email' | 'phone', value: string): Promise<IUser[]> {
  if (type === 'email') {
    return User.find({ email: value });
  }
  // Phone is not unique, so every match is checked against the password below.
  return User.find({ phone: value }).limit(MAX_PHONE_MATCHES);
}

export async function requestAccountDeletion(req: Request, res: Response): Promise<void> {
  const { identifier, password, confirm } = req.body ?? {};

  if (identifier === undefined || password === undefined || confirm === undefined) {
    res.status(400).json({ message: 'identifier, password and confirm are required' });
    return;
  }

  if (confirm !== DELETE_CONFIRMATION) {
    res.status(400).json({ message: `confirm must be "${DELETE_CONFIRMATION}"` });
    return;
  }

  const normalized = normalizeIdentifier(identifier);
  if (!normalized) {
    res.status(400).json({ message: 'identifier must be a valid email or phone number' });
    return;
  }

  if (!isValidPasswordInput(password)) {
    res.status(400).json({ message: 'password is required' });
    return;
  }

  const candidates = await findCandidates(normalized.type, normalized.value);

  const passwordChecks =
    candidates.length > 0
      ? await Promise.all(candidates.map((candidate) => candidate.comparePassword(password)))
      : [await bcrypt.compare(password, DUMMY_PASSWORD_HASH)];

  const matches = candidates.filter((_, index) => passwordChecks[index]);

  // Zero matches is a failure. More than one match is ambiguous (shared phone and password), so it is refused too.
  if (matches.length !== 1) {
    res.status(401).json(INVALID_CREDENTIALS);
    return;
  }

  await deleteUserAccount(matches[0].id, AuditSource.WEB);

  res.status(200).json({ message: 'Account deleted' });
}
