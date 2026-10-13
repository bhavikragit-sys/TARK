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
const { default: Order } = await import('../src/modules/orders/order.model.js');

let testUser;
let authCookie;
let otherUser;

async function loginAndGetCookie(user) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({
      email: user.email,
      password: 'TestPassword123',
    });

  expect(response.status).toBe(200);

  const cookie = (response.headers['set-cookie'] ?? [])
    .find((value) => value.startsWith('tark_token='));

  expect(cookie).toBeDefined();

  return cookie.split(';')[0];
}

beforeAll(async () => {
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  const email = `order-history-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@example.com`;

  testUser = await User.create({
    name: 'Order History Test User',
    email,
    password: 'TestPassword123',
  });

  await Account.create({
    userId: testUser._id,
  });

  authCookie = await loginAndGetCookie(testUser);
});

afterEach(async () => {
  if (testUser) {
    await Order.deleteMany({ userId: testUser._id });
    await Account.deleteMany({ userId: testUser._id });
    await User.deleteOne({ _id: testUser._id });
  }

  if (otherUser) {
    await Order.deleteMany({ userId: otherUser._id });
    await Account.deleteMany({ userId: otherUser._id });
    await User.deleteOne({ _id: otherUser._id });
  }

  testUser = null;
  otherUser = null;
  authCookie = null;
});

describe('Order history API', () => {
  test('rejects requests without authentication', async () => {
    const response = await request(app).get('/api/orders');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('returns only the authenticated user orders', async () => {
    await Order.create([
      {
        userId: testUser._id,
        symbol: 'INFY',
        side: 'BUY',
        orderType: 'MARKET',
        quantity: 2,
        status: 'EXECUTED',
        executionPricePaise: 101540,
        totalAmountPaise: 203080,
        executedAt: new Date(),
      },
      {
        userId: testUser._id,
        symbol: 'TCS',
        side: 'SELL',
        orderType: 'MARKET',
        quantity: 1,
        status: 'EXECUTED',
        executionPricePaise: 350000,
        totalAmountPaise: 350000,
        executedAt: new Date(),
      },
    ]);

    const response = await request(app)
      .get('/api/orders')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(2);
    expect(response.body.orders).toHaveLength(2);

    const symbols = response.body.orders.map((order) => order.symbol);

    expect(symbols).toContain('INFY');
    expect(symbols).toContain('TCS');

    expect(
      response.body.orders.every(
        (order) => order.userId === testUser._id.toString()
      )
    ).toBe(true);
  });

  test('returns an empty array when the user has no orders', async () => {
    const response = await request(app)
      .get('/api/orders')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(0);
    expect(response.body.orders).toEqual([]);
  });

  test('does not return another users orders', async () => {
    const email = `other-order-user-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;

    otherUser = await User.create({
      name: 'Another Test User',
      email,
      password: 'TestPassword123',
    });

    await Account.create({
      userId: otherUser._id,
    });

    await Order.create({
      userId: otherUser._id,
      symbol: 'RELIANCE',
      side: 'BUY',
      orderType: 'MARKET',
      quantity: 1,
      status: 'EXECUTED',
      executionPricePaise: 125000,
      totalAmountPaise: 125000,
      executedAt: new Date(),
    });

    const response = await request(app)
      .get('/api/orders')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.orders).toHaveLength(0);
    expect(response.body.count).toBe(0);
  });

  test('returns orders newest first', async () => {
    const olderDate = new Date('2026-01-01T10:00:00.000Z');
    const newerDate = new Date('2026-01-02T10:00:00.000Z');

    await Order.create([
      {
        userId: testUser._id,
        symbol: 'INFY',
        side: 'BUY',
        orderType: 'MARKET',
        quantity: 1,
        status: 'EXECUTED',
        executionPricePaise: 101540,
        totalAmountPaise: 101540,
        createdAt: olderDate,
      },
      {
        userId: testUser._id,
        symbol: 'TCS',
        side: 'BUY',
        orderType: 'MARKET',
        quantity: 1,
        status: 'EXECUTED',
        executionPricePaise: 350000,
        totalAmountPaise: 350000,
        createdAt: newerDate,
      },
    ]);

    const response = await request(app)
      .get('/api/orders')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.orders).toHaveLength(2);
    expect(response.body.orders[0].symbol).toBe('TCS');
    expect(response.body.orders[1].symbol).toBe('INFY');
  });
});