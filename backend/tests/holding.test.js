import dotenv from 'dotenv';
import { jest } from '@jest/globals';

dotenv.config({ path: '.env.test', override: true });

const { default: request } = await import('supertest');
const { default: app } = await import('../src/app.js');

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

const { default: mongoose } = await import('mongoose');
const { default: User } = await import('../src/modules/users/user.model.js');
const { default: Account } = await import(
  '../src/modules/accounts/account.model.js'
);
const { default: Holding } = await import(
  '../src/modules/holdings/holding.model.js'
);

let testUser;
let testAccount;
let authCookie;

beforeAll(async () => {
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  const email = `holding-test-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@example.com`;

  testUser = await User.create({
    name: 'Holding Test User',
    email,
    password: 'TestPassword123',
  });

  testAccount = await Account.create({
    userId: testUser._id,
  });

  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({
      email: testUser.email,
      password: 'TestPassword123',
    });

  expect(loginResponse.status).toBe(200);

  authCookie = (loginResponse.headers['set-cookie'] ?? [])
    .find((cookie) => cookie.startsWith('tark_token='));

  expect(authCookie).toBeDefined();
  authCookie = authCookie.split(';')[0];
});

afterEach(async () => {
  if (!testUser) return;

  const userId = testUser._id;

  // Delete only this test user's records.
  await Holding.deleteMany({ userId });
  await Account.deleteMany({ userId });
  await User.deleteOne({ _id: userId });

  testUser = null;
  testAccount = null;
  authCookie = null;
});

describe('Holdings API', () => {
  test('rejects requests without authentication', async () => {
    const response = await request(app)
      .get('/api/holdings');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('returns the authenticated user holdings', async () => {
    await Holding.create({
      userId: testUser._id,
      symbol: 'INFY',
      quantity: 5,
      averagePricePaise: 101540,
    });

    await Holding.create({
      userId: testUser._id,
      symbol: 'TCS',
      quantity: 2,
      averagePricePaise: 340000,
    });

    const response = await request(app)
      .get('/api/holdings')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(2);
    expect(response.body.holdings).toHaveLength(2);

    expect(response.body.holdings[0]).toMatchObject({
      symbol: 'INFY',
      quantity: 5,
      averagePricePaise: 101540,
      averagePrice: 1015.4,
    });

    expect(response.body.holdings[1]).toMatchObject({
      symbol: 'TCS',
      quantity: 2,
      averagePricePaise: 340000,
      averagePrice: 3400,
    });
  });

  test('returns an empty array when the user has no holdings', async () => {
    const response = await request(app)
      .get('/api/holdings')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(0);
    expect(response.body.holdings).toEqual([]);
  });

  test('excludes holdings with zero quantity', async () => {
    await Holding.create({
      userId: testUser._id,
      symbol: 'INFY',
      quantity: 0,
      averagePricePaise: 101540,
    });

    await Holding.create({
      userId: testUser._id,
      symbol: 'TCS',
      quantity: 2,
      averagePricePaise: 340000,
    });

    const response = await request(app)
      .get('/api/holdings')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.holdings).toHaveLength(1);
    expect(response.body.holdings[0].symbol).toBe('TCS');
  });

  test('does not return another users holdings', async () => {
    const otherEmail = `other-holding-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;

    const otherUser = await User.create({
      name: 'Other Test User',
      email: otherEmail,
      password: 'TestPassword123',
    });

    try {
      await Account.create({
        userId: otherUser._id,
      });

      await Holding.create({
        userId: testUser._id,
        symbol: 'INFY',
        quantity: 3,
        averagePricePaise: 101540,
      });

      await Holding.create({
        userId: otherUser._id,
        symbol: 'TCS',
        quantity: 7,
        averagePricePaise: 340000,
      });

      const response = await request(app)
        .get('/api/holdings')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);

      expect(
        response.body.holdings.map((holding) => holding.symbol)
      ).toEqual(['INFY']);

      expect(
        response.body.holdings.some(
          (holding) => holding.symbol === 'TCS'
        )
      ).toBe(false);
    } finally {
      await Holding.deleteMany({ userId: otherUser._id });
      await Account.deleteMany({ userId: otherUser._id });
      await User.deleteOne({ _id: otherUser._id });
    }
  });
});