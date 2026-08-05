import { Response } from 'express';
import { User } from '../models/user.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { EMAIL_REGEX, PHONE_REGEX, MIN_PASSWORD_LENGTH } from '../utils/validators';

export async function getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = await User.findById(req.userId);

  if (!user) {
    res.status(404).json({ message: 'user not found' });
    return;
  }

  res.status(200).json({ id: user.id, name: user.name, email: user.email, phone: user.phone ?? null });
}

export async function updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name, email, phone } = req.body;

  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    res.status(400).json({ message: 'name must be a non-empty string' });
    return;
  }

  if (email !== undefined && !EMAIL_REGEX.test(email)) {
    res.status(400).json({ message: 'email must be a valid email address' });
    return;
  }

  if (phone !== undefined && phone !== null && !PHONE_REGEX.test(phone)) {
    res.status(400).json({ message: 'phone must be a valid phone number' });
    return;
  }

  if (email !== undefined) {
    const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: req.userId } });

    if (existing) {
      res.status(409).json({ message: 'email is already registered' });
      return;
    }
  }

  const update = {
    ...(name !== undefined ? { name } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(phone !== undefined ? { phone: phone || null } : {}),
  };

  const user = await User.findByIdAndUpdate(req.userId, update, { new: true, runValidators: true });

  if (!user) {
    res.status(404).json({ message: 'user not found' });
    return;
  }

  res.status(200).json({ id: user.id, name: user.name, email: user.email, phone: user.phone ?? null });
}

export async function changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ message: 'currentPassword and newPassword are required' });
    return;
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ message: `newPassword must be at least ${MIN_PASSWORD_LENGTH} characters` });
    return;
  }

  const user = await User.findById(req.userId);

  if (!user || !(await user.comparePassword(currentPassword))) {
    res.status(401).json({ message: 'current password is incorrect' });
    return;
  }

  user.password = newPassword;
  user.refreshToken = undefined;
  await user.save();

  res.status(204).send();
}
