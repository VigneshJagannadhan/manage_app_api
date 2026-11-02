import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../src/app';
import { User } from '../src/models/user.model';
import { Group } from '../src/models/group.model';
import { Membership, MembershipRole } from '../src/models/membership.model';
import { Task, TaskPriority } from '../src/models/task.model';
import { Expense, ExpenseCategory } from '../src/models/expense.model';
import { Journal } from '../src/models/journal.model';
import { AuditLog } from '../src/models/auditLog.model';
import { RateLimit } from '../src/models/rateLimit.model';
import { DELETED_USER_ID, deleteUserAccount } from '../src/services/account.service';
import { AuditSource } from '../src/models/auditLog.model';
import { WEB_DELETE_IDENTIFIER_LIMIT, WEB_DELETE_IP_LIMIT } from '../src/utils/rateLimiter';

const PASSWORD = 'correct-horse';
let replSet: MongoMemoryReplSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  await Promise.all([RateLimit.init(), AuditLog.init(), User.init()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Group.deleteMany({}),
    Membership.deleteMany({}),
    Task.deleteMany({}),
    Expense.deleteMany({}),
    Journal.deleteMany({}),
    AuditLog.deleteMany({}),
    RateLimit.deleteMany({}),
  ]);
});

async function signup(email: string, name = 'Test User') {
  const res = await request(app).post('/api/auth/signup').send({ name, email, password: PASSWORD });
  return {
    id: res.body.user.id as string,
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
  };
}

async function seedGroupData(userId: string) {
  const group = await Group.create({ name: 'Home', inviteCode: `CODE${userId.slice(-4)}`, createdBy: userId });
  await Membership.create({ groupId: group.id, userId, role: MembershipRole.OWNER });
  await Task.create({
    title: 't', description: 'd', priority: TaskPriority.LOW, groupId: group.id, createdBy: userId, assignedTo: userId,
  });
  await Expense.create({
    title: 'e', amount: 10, category: ExpenseCategory.FOOD, date: new Date(), groupId: group.id,
    userId, payer: { userId }, splits: [{ userId, amountOwed: 10 }],
  });
  await Journal.create({ userId, date: new Date(), content: 'secret diary' });
  return group;
}

const webDelete = (body: object, origin?: string) => {
  const req = request(app).post('/api/account/delete-request');
  if (origin) req.set('Origin', origin);
  return req.send(body);
};

describe('DELETE /api/account (app)', () => {
  it('deletes the account and all related data', async () => {
    const user = await signup('app@example.com');
    const group = await seedGroupData(user.id);

    const res = await request(app)
      .delete('/api/account')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ password: PASSWORD });

    expect(res.status).toBe(200);
    expect(await User.countDocuments()).toBe(0);
    expect(await Membership.countDocuments({ userId: user.id })).toBe(0);
    expect(await Journal.countDocuments({ userId: user.id })).toBe(0);
    expect(await Task.countDocuments()).toBe(0);
    expect(await Expense.countDocuments()).toBe(0);
    expect(await Group.findById(group.id)).toBeNull();
  });

  it('rejects a wrong password and keeps the data', async () => {
    const user = await signup('app@example.com');
    await seedGroupData(user.id);

    const res = await request(app)
      .delete('/api/account')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ password: 'wrong-password' });

    expect(res.status).toBe(403);
    expect(await User.countDocuments()).toBe(1);
    expect(await Journal.countDocuments()).toBe(1);
  });

  it('requires authentication', async () => {
    const res = await request(app).delete('/api/account').send({ password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it('stops access and refresh tokens from working after deletion', async () => {
    const user = await signup('app@example.com');

    await request(app).delete('/api/account').set('Authorization', `Bearer ${user.accessToken}`).send({ password: PASSWORD });

    const profile = await request(app).get('/api/profile').set('Authorization', `Bearer ${user.accessToken}`);
    const refresh = await request(app).post('/api/auth/refresh').send({ refreshToken: user.refreshToken });
    const signin = await request(app).post('/api/auth/signin').send({ email: 'app@example.com', password: PASSWORD });

    expect(profile.status).toBe(401);
    expect(refresh.status).toBe(401);
    expect(signin.status).toBe(401);
  });
});

describe('POST /api/account/delete-request (web)', () => {
  it('deletes by email and writes an audit log without personal data', async () => {
    const user = await signup('Web@Example.com');
    await seedGroupData(user.id);

    const res = await webDelete({ identifier: '  web@example.com ', password: PASSWORD, confirm: 'DELETE' });

    expect(res.status).toBe(200);
    expect(await User.countDocuments()).toBe(0);

    const logs = await AuditLog.find().lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ userId: user.id, source: 'web' });
    expect(JSON.stringify(logs[0])).not.toContain('example.com');
  });

  it('deletes by phone number, ignoring separators', async () => {
    const user = await signup('phone@example.com');
    await User.updateOne({ _id: user.id }, { phone: '+14155550123' });

    const res = await webDelete({ identifier: '+1 (415) 555-0123', password: PASSWORD, confirm: 'DELETE' });

    expect(res.status).toBe(200);
    expect(await User.countDocuments()).toBe(0);
  });

  it('refuses an ambiguous phone number shared by two accounts with the same password', async () => {
    const a = await signup('a@example.com');
    const b = await signup('b@example.com');
    await User.updateMany({ _id: { $in: [a.id, b.id] } }, { phone: '+14155550123' });

    const res = await webDelete({ identifier: '+14155550123', password: PASSWORD, confirm: 'DELETE' });

    expect(res.status).toBe(401);
    expect(await User.countDocuments()).toBe(2);
  });

  it('returns the same response for a wrong password and an unknown identifier', async () => {
    await signup('real@example.com');

    const wrongPassword = await webDelete({ identifier: 'real@example.com', password: 'nope-nope', confirm: 'DELETE' });
    const unknown = await webDelete({ identifier: 'ghost@example.com', password: 'nope-nope', confirm: 'DELETE' });

    expect(wrongPassword.status).toBe(401);
    expect(unknown.status).toBe(wrongPassword.status);
    expect(unknown.body).toEqual(wrongPassword.body);
    expect(wrongPassword.body).toEqual({ message: 'Invalid credentials' });
    expect(await User.countDocuments()).toBe(1);
  });

  it.each([
    ['missing', undefined],
    ['wrong case', 'delete'],
    ['wrong value', 'yes'],
  ])('rejects a %s confirm', async (_label, confirm) => {
    await signup('real@example.com');

    const res = await webDelete({ identifier: 'real@example.com', password: PASSWORD, ...(confirm ? { confirm } : {}) });

    expect(res.status).toBe(400);
    expect(await User.countDocuments()).toBe(1);
  });

  it('rejects malformed input types', async () => {
    const res = await webDelete({ identifier: { $ne: '' }, password: { $ne: '' }, confirm: 'DELETE' });
    expect(res.status).toBe(400);
  });

  it('returns invalid credentials when the account was already deleted', async () => {
    await signup('gone@example.com');
    const body = { identifier: 'gone@example.com', password: PASSWORD, confirm: 'DELETE' };

    expect((await webDelete(body)).status).toBe(200);
    const second = await webDelete(body);

    expect(second.status).toBe(401);
    expect(second.body).toEqual({ message: 'Invalid credentials' });
  });

  it('rate limits per identifier', async () => {
    await signup('target@example.com');
    const body = { identifier: 'target@example.com', password: 'wrong-pass', confirm: 'DELETE' };

    for (let i = 0; i < WEB_DELETE_IDENTIFIER_LIMIT.max; i++) {
      expect((await webDelete(body)).status).toBe(401);
    }
    const blocked = await webDelete(body);
    // Even the correct password is refused while locked out.
    const blockedCorrect = await webDelete({ ...body, password: PASSWORD });

    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blockedCorrect.status).toBe(429);
    expect(await User.countDocuments()).toBe(1);
  });

  it('rate limits per IP across different identifiers', async () => {
    for (let i = 0; i < WEB_DELETE_IP_LIMIT.max; i++) {
      await webDelete({ identifier: `user${i}@example.com`, password: 'wrong-pass', confirm: 'DELETE' });
    }

    const res = await webDelete({ identifier: 'another@example.com', password: 'wrong-pass', confirm: 'DELETE' });

    expect(res.status).toBe(429);
  });

  it('allows only the configured web origin', async () => {
    const allowed = await request(app)
      .options('/api/account/delete-request')
      .set('Origin', 'https://site.example')
      .set('Access-Control-Request-Method', 'POST');
    const other = await request(app)
      .options('/api/account/delete-request')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');

    expect(allowed.status).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('https://site.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not echo malformed JSON bodies', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await request(app)
      .post('/api/account/delete-request')
      .set('Content-Type', 'application/json')
      .send('{"identifier":"a@b.co","password":"hunter2-secret",');

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('deleteUserAccount service', () => {
  it('transfers ownership to the longest-standing member when others remain', async () => {
    const owner = await signup('owner@example.com');
    const first = await signup('first@example.com');
    const second = await signup('second@example.com');
    const group = await Group.create({ name: 'Shared', inviteCode: 'SHARED01', createdBy: owner.id });
    await Membership.create({ groupId: group.id, userId: owner.id, role: MembershipRole.OWNER });
    await Membership.create({ groupId: group.id, userId: first.id, joinedAt: new Date(Date.now() - 2000) });
    await Membership.create({ groupId: group.id, userId: second.id, joinedAt: new Date(Date.now() - 1000) });

    expect(await deleteUserAccount(owner.id, AuditSource.APP)).toBe(true);

    const updated = await Group.findById(group.id);
    expect(updated?.createdBy).toBe(first.id);
    expect((await Membership.findOne({ groupId: group.id, userId: first.id }))?.role).toBe(MembershipRole.OWNER);
    expect(await Membership.countDocuments({ groupId: group.id })).toBe(2);
  });

  it('keeps other members data, reassigns tasks and anonymizes references', async () => {
    const leaver = await signup('leaver@example.com');
    const stayer = await signup('stayer@example.com');
    const group = await Group.create({ name: 'Shared', inviteCode: 'SHARED02', createdBy: stayer.id });
    await Membership.create({ groupId: group.id, userId: stayer.id, role: MembershipRole.OWNER });
    await Membership.create({ groupId: group.id, userId: leaver.id });
    await User.updateOne({ _id: leaver.id }, { defaultGroupId: group.id });

    const stayerExpense = await Expense.create({
      title: 'dinner', amount: 20, category: ExpenseCategory.FOOD, date: new Date(), groupId: group.id,
      userId: stayer.id, payer: { userId: leaver.id },
      splits: [{ userId: leaver.id, amountOwed: 10 }, { userId: stayer.id, amountOwed: 10 }],
    });
    await Expense.create({
      title: 'mine', amount: 5, category: ExpenseCategory.FOOD, date: new Date(), groupId: group.id,
      userId: leaver.id, payer: { userId: leaver.id }, splits: [],
    });
    const assigned = await Task.create({
      title: 'chore', description: 'd', priority: TaskPriority.LOW, groupId: group.id,
      createdBy: stayer.id, assignedTo: leaver.id,
    });
    await Task.create({
      title: 'own', description: 'd', priority: TaskPriority.LOW, groupId: group.id,
      createdBy: leaver.id, assignedTo: leaver.id,
    });

    expect(await deleteUserAccount(leaver.id, AuditSource.APP)).toBe(true);

    expect(await Group.findById(group.id)).not.toBeNull();
    expect(await Expense.countDocuments({ userId: leaver.id })).toBe(0);
    const kept = await Expense.findById(stayerExpense.id).lean();
    expect(kept?.payer.userId).toBe(DELETED_USER_ID);
    expect(kept?.splits.map((split) => split.userId).sort()).toEqual([DELETED_USER_ID, stayer.id].sort());
    expect((await Task.findById(assigned.id))?.assignedTo).toBe(stayer.id);
    expect(await Task.countDocuments({ createdBy: leaver.id })).toBe(0);
  });

  it('deletes a group when the owner is the only member', async () => {
    const owner = await signup('solo@example.com');
    const group = await seedGroupData(owner.id);

    await deleteUserAccount(owner.id, AuditSource.APP);

    expect(await Group.findById(group.id)).toBeNull();
    expect(await Membership.countDocuments({ groupId: group.id })).toBe(0);
  });

  it('is safe to call for a user that is already deleted or invalid', async () => {
    const user = await signup('twice@example.com');

    expect(await deleteUserAccount(user.id, AuditSource.APP)).toBe(true);
    expect(await deleteUserAccount(user.id, AuditSource.APP)).toBe(false);
    expect(await deleteUserAccount('not-an-id', AuditSource.APP)).toBe(false);
    expect(await AuditLog.countDocuments()).toBe(1);
  });
});
