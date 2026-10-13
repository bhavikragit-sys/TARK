import dotenv from 'dotenv';

dotenv.config({ path: '.env.test', override: true });

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error('MONGODB_URI is missing from .env.test');
}

const databaseName = new URL(mongoUri).pathname.replace(/^\/+/, '');

if (databaseName !== 'tark_test') {
  throw new Error(
    `Unsafe test database "${databaseName}". Expected "tark_test".`
  );
}

const { default: request } = await import('supertest');
const { default: app } = await import('../src/app.js');
const { default: mongoose } = await import('mongoose');
const { default: User } = await import('../src/modules/users/user.model.js');
const { default: Account } = await import('../src/modules/accounts/account.model.js');
const { default: Ledger } = await import('../src/modules/ledger/ledger.model.js');

let testUser;
let authCookie;
let otherUser;

beforeAll(async () => {
  await mongoose.connect(mongoUri);
}, 15000);

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  const email = `ledger-test-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@example.com`;

  testUser = await User.create({
    name: 'Ledger Test User',
    email,
    password: 'TestPassword123',
  });

  await Account.create({
    userId: testUser._id,
  });

  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({
      email: testUser.email,
      password: 'TestPassword123',
    });

  expect(loginResponse.status).toBe(200);

  authCookie = (loginResponse.headers['set-cookie'] ?? []).find(
    (cookie) => cookie.startsWith('tark_token=')
  );

  expect(authCookie).toBeDefined();
  authCookie = authCookie.split(';')[0];
});

afterEach(async () => {
  if (testUser) {
    await Ledger.deleteMany({ userId: testUser._id });
    await Account.deleteMany({ userId: testUser._id });
    await User.deleteOne({ _id: testUser._id });
  }

  if (otherUser) {
    await Ledger.deleteMany({ userId: otherUser._id });
    await Account.deleteMany({ userId: otherUser._id });
    await User.deleteOne({ _id: otherUser._id });
  }

  testUser = null;
  otherUser = null;
  authCookie = null;
});

describe('Ledger History API', () => {
  test('rejects requests without authentication', async () => {
    const response = await request(app).get('/api/account/ledger');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('returns the authenticated user ledger entries', async () => {
    const account = await Account.findOne({
      userId: testUser._id,
    });

    await Ledger.create([
      {
        userId: testUser._id,
        accountId: account._id,
        entryType: 'INITIAL_CREDIT',
        amountPaise: 10000000,
        balanceAfterPaise: 10000000,
        description: 'Initial virtual funds',
        idempotencyKey: `initial-${testUser._id}`,
      },
      {
        userId: testUser._id,
        accountId: account._id,
        entryType: 'BUY_DEBIT',
        amountPaise: 203080,
        balanceAfterPaise: 9796920,
        description: 'Bought 2 INFY shares',
        idempotencyKey: `buy-${testUser._id}`,
      },
    ]);

    const response = await request(app)
      .get('/api/account/ledger')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(2);
    expect(response.body.entries).toHaveLength(2);

    expect(
      response.body.entries.every(
        (entry) => entry.userId === testUser._id.toString()
      )
    ).toBe(true);
  });

  test('returns an empty array when the user has no ledger entries', async () => {
    const response = await request(app)
      .get('/api/account/ledger')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(0);
    expect(response.body.entries).toEqual([]);
  });

  test('does not return another user ledger entries', async () => {
    const email = `other-ledger-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;

    otherUser = await User.create({
      name: 'Other Ledger User',
      email,
      password: 'TestPassword123',
    });

    const otherAccount = await Account.create({
      userId: otherUser._id,
    });

    await Ledger.create({
      userId: otherUser._id,
      accountId: otherAccount._id,
      entryType: 'INITIAL_CREDIT',
      amountPaise: 10000000,
      balanceAfterPaise: 10000000,
      description: 'Other user initial funds',
      idempotencyKey: `other-initial-${otherUser._id}`,
    });

    const response = await request(app)
      .get('/api/account/ledger')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(0);
    expect(response.body.entries).toEqual([]);
  });

  test('returns ledger entries newest first', async () => {
    const account = await Account.findOne({
      userId: testUser._id,
    });

    const olderDate = new Date('2026-01-01T10:00:00.000Z');
    const newerDate = new Date('2026-01-02T10:00:00.000Z');

    await Ledger.create([
      {
        userId: testUser._id,
        accountId: account._id,
        entryType: 'INITIAL_CREDIT',
        amountPaise: 10000000,
        balanceAfterPaise: 10000000,
        description: 'Initial virtual funds',
        idempotencyKey: `older-${testUser._id}`,
        createdAt: olderDate,
      },
      {
        userId: testUser._id,
        accountId: account._id,
        entryType: 'BUY_DEBIT',
        amountPaise: 203080,
        balanceAfterPaise: 9796920,
        description: 'Bought INFY shares',
        idempotencyKey: `newer-${testUser._id}`,
        createdAt: newerDate,
      },
    ]);

    const response = await request(app)
      .get('/api/account/ledger')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.entries).toHaveLength(2);
    expect(response.body.entries[0].description).toBe(
      'Bought INFY shares'
    );
    expect(response.body.entries[1].description).toBe(
      'Initial virtual funds'
    );
  });
});