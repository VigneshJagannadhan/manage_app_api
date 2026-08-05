import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { EMAIL_REGEX, MIN_PASSWORD_LENGTH } from '../utils/validators';

async function issueTokens(userId: string, email: string) {
  const accessToken = signAccessToken({ sub: userId, email });
  const refreshToken = signRefreshToken({ sub: userId, email });
  const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

  await User.findByIdAndUpdate(userId, { refreshToken: hashedRefreshToken });

  return { accessToken, refreshToken };
}

export async function signup(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ message: 'name, email and password are required' });
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    res.status(400).json({ message: 'email must be a valid email address' });
    return;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ message: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    return;
  }

  const existing = await User.findOne({ email: email.toLowerCase() });

  if (existing) {
    res.status(409).json({ message: 'email is already registered' });
    return;
  }

  const user = await User.create({ name, email, password });
  const { accessToken, refreshToken } = await issueTokens(user.id, user.email);

  res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email },
    accessToken,
    refreshToken,
  });
}

export async function signin(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: 'email and password are required' });
    return;
  }

  console.log('[signin] looking up user', email);
  const user = await User.findOne({ email: email.toLowerCase() });
  console.log('[signin] user found:', !!user);

  if (!user || !(await user.comparePassword(password))) {
    res.status(401).json({ message: 'invalid email or password' });
    return;
  }

  console.log('[signin] password ok, issuing tokens');
  const { accessToken, refreshToken } = await issueTokens(user.id, user.email);
  console.log('[signin] tokens issued');

  res.status(200).json({
    user: { id: user.id, name: user.name, email: user.email },
    accessToken,
    refreshToken,
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ message: 'refreshToken is required' });
    return;
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    res.status(401).json({ message: 'invalid or expired refresh token' });
    return;
  }

  const user = await User.findById(payload.sub).select('+refreshToken');

  if (!user || !user.refreshToken || !(await bcrypt.compare(refreshToken, user.refreshToken))) {
    res.status(401).json({ message: 'invalid or expired refresh token' });
    return;
  }

  const tokens = await issueTokens(user.id, user.email);

  res.status(200).json(tokens);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ message: 'refreshToken is required' });
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    await User.findByIdAndUpdate(payload.sub, { $unset: { refreshToken: 1 } });
  } catch {
    // token already invalid/expired - nothing to revoke
  }

  res.status(204).send();
}
