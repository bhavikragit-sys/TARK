import dotenv from 'dotenv';
import { jest } from '@jest/globals';
const { default: request } = await import('supertest');
const { default: app } = await import('../src/app.js');

// Load test environment before importing models or services.
dotenv.config({ path: '.env.test', override: true });

// Safety guard: refuse to run against any database except tark_test.
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

// Import only after validating the test environment.
const { default: mongoose } = await import('mongoose');
const { default: User } = await import('../src/modules/users/user.model.js');
const { default: Account } = await import(
  '../src/modules/accounts/account.model.js'
);
const { default: Order } = await import(
  '../src/modules/orders/order.model.js'
);
const { default: Holding } = await import(
  '../src/modules/holdings/holding.model.js'
);
const { default: Ledger } = await import(
  '../src/modules/ledger/ledger.model.js'
);
const { executeOrder } = await import(
  '../src/modules/orders/order.service.js'
);


let testUser;
let testAccount;

beforeAll(async () => {
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  const email = `order-test-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@example.com`;

  testUser = await User.create({
    name: 'Order Test User',
    email,
    password: 'TestPassword123',
  });

  testAccount = await Account.create({
    userId: testUser._id,
  });
});

afterEach(async () => {
  if (!testUser) return;

  const userId = testUser._id;

  // Delete only records associated with this test user.
  await Order.deleteMany({ userId });
  await Holding.deleteMany({ userId });
  await Ledger.deleteMany({ userId });
  await Account.deleteMany({ userId });
  await User.deleteOne({ _id: userId });

  testUser = null;
  testAccount = null;
});

describe('Order execution', () => {
  test('executes a BUY and updates balance, holding, order, and ledger', async () => {
    const order = await executeOrder({
      userId: testUser._id,
      symbol: 'INFY',
      side: 'BUY',
      quantity: 2,
    });

    // 1. Verify the order.
    expect(order.status).toBe('EXECUTED');
    expect(order.symbol).toBe('INFY');
    expect(order.side).toBe('BUY');
    expect(order.quantity).toBe(2);
    expect(order.executionPricePaise).toBe(101540);
    expect(order.totalAmountPaise).toBe(203080);

    // 2. Verify the account balance.
    const updatedAccount = await Account.findOne({
      userId: testUser._id,
    });

    expect(updatedAccount.availableBalance).toBe(9796920);

    // 3. Verify the holding.
    const holding = await Holding.findOne({
      userId: testUser._id,
      symbol: 'INFY',
    });

    expect(holding).not.toBeNull();
    expect(holding.quantity).toBe(2);
    expect(holding.averagePricePaise).toBe(101540);

    // 4. Verify the ledger entry.
    const ledgerEntry = await Ledger.findOne({
      userId: testUser._id,
      orderId: order._id,
    });

    expect(ledgerEntry).not.toBeNull();
    expect(ledgerEntry.entryType).toBe('BUY_DEBIT');
    expect(ledgerEntry.amountPaise).toBe(203080);
    expect(ledgerEntry.balanceAfterPaise).toBe(9796920);
  });


  test('rejects a BUY when funds are insufficient without changing records', async () => {
  // Give this test account exactly ₹2,000.
  testAccount.availableBalance = 200000;
  await testAccount.save();

  await expect(
    executeOrder({
      userId: testUser._id,
      symbol: 'INFY',
      side: 'BUY',
      quantity: 2,
    })
  ).rejects.toMatchObject({
    statusCode: 400,
    message: 'Insufficient funds',
  });

  // The account balance must remain unchanged.
  const account = await Account.findOne({
    userId: testUser._id,
  });

  expect(account.availableBalance).toBe(200000);

  // No holding should have been created.
  const holdings = await Holding.find({ userId: testUser._id });
  expect(holdings).toHaveLength(0);

  // No order should have been recorded.
  const orders = await Order.find({ userId: testUser._id });
  expect(orders).toHaveLength(0);

  // No ledger entry should have been recorded.
  const entries = await Ledger.find({ userId: testUser._id });
  expect(entries).toHaveLength(0);
});



test('executes a SELL and credits the account correctly', async () => {
  // Create a holding of 5 INFY shares.
  await Holding.create({
    userId: testUser._id,
    symbol: 'INFY',
    quantity: 5,
    averagePricePaise: 101540,
  });

  // Sell 2 shares.
  const order = await executeOrder({
    userId: testUser._id,
    symbol: 'INFY',
    side: 'SELL',
    quantity: 2,
  });

  // Verify the order.
  expect(order.status).toBe('EXECUTED');
  expect(order.side).toBe('SELL');
  expect(order.quantity).toBe(2);
  expect(order.totalAmountPaise).toBe(203080);

  // Verify the remaining holding.
  const holding = await Holding.findOne({
    userId: testUser._id,
    symbol: 'INFY',
  });

  expect(holding.quantity).toBe(3);

  // Verify the sale proceeds were credited.
  const account = await Account.findOne({
    userId: testUser._id,
  });

  expect(account.availableBalance).toBe(10203080);

  // Verify the ledger credit.
  const ledgerEntry = await Ledger.findOne({
    userId: testUser._id,
    orderId: order._id,
  });

  expect(ledgerEntry.entryType).toBe('SELL_CREDIT');
  expect(ledgerEntry.amountPaise).toBe(203080);
  expect(ledgerEntry.balanceAfterPaise).toBe(10203080);
});


test('rejects selling more shares than the user owns', async () => {
  await Holding.create({
    userId: testUser._id,
    symbol: 'INFY',
    quantity: 5,
    averagePricePaise: 101540,
  });

  await expect(
    executeOrder({
      userId: testUser._id,
      symbol: 'INFY',
      side: 'SELL',
      quantity: 6,
    })
  ).rejects.toMatchObject({
    statusCode: 400,
    message: 'Insufficient shares to sell',
  });

  // Balance must remain unchanged.
  const account = await Account.findOne({
    userId: testUser._id,
  });

  expect(account.availableBalance).toBe(10000000);

  // The original holding must remain unchanged.
  const holding = await Holding.findOne({
    userId: testUser._id,
    symbol: 'INFY',
  });

  expect(holding.quantity).toBe(5);

  // No order or ledger entry should be created.
  expect(await Order.countDocuments({ userId: testUser._id })).toBe(0);
  expect(await Ledger.countDocuments({ userId: testUser._id })).toBe(0);
});


test('rolls back the entire BUY when ledger creation fails', async () => {
  const ledgerSpy = jest
    .spyOn(Ledger.prototype, 'save')
    .mockRejectedValueOnce(new Error('Simulated ledger failure'));

  try {
    await expect(
      executeOrder({
        userId: testUser._id,
        symbol: 'INFY',
        side: 'BUY',
        quantity: 2,
      })
    ).rejects.toThrow('Simulated ledger failure');

    const account = await Account.findOne({
      userId: testUser._id,
    });

    const holding = await Holding.findOne({
      userId: testUser._id,
      symbol: 'INFY',
    });

    expect(account.availableBalance).toBe(10000000);
    expect(holding).toBeNull();

    expect(
      await Order.countDocuments({ userId: testUser._id })
    ).toBe(0);

    expect(
      await Ledger.countDocuments({ userId: testUser._id })
    ).toBe(0);
  } finally {
    ledgerSpy.mockRestore();
  }
});

test('does not allow concurrent BUY orders to overspend the account', async () => {
  // Give the account ₹3,000 (300000 paise).
  testAccount.availableBalance = 300000;
  await testAccount.save();

  // Both orders cost ₹2,030.80, so only one can succeed.
  const results = await Promise.allSettled([
    executeOrder({
      userId: testUser._id,
      symbol: 'INFY',
      side: 'BUY',
      quantity: 2,
    }),
    executeOrder({
      userId: testUser._id,
      symbol: 'INFY',
      side: 'BUY',
      quantity: 2,
    }),
  ]);

  const successfulOrders = results.filter(
    (result) => result.status === 'fulfilled'
  );

  const failedOrders = results.filter(
    (result) => result.status === 'rejected'
  );

  // Exactly one order should succeed.
  expect(successfulOrders).toHaveLength(1);
  expect(failedOrders).toHaveLength(1);

  // Verify the final database state.
  const account = await Account.findOne({
    userId: testUser._id,
  });

  const holding = await Holding.findOne({
    userId: testUser._id,
    symbol: 'INFY',
  });

  expect(account.availableBalance).toBe(300000 - 203080);
  expect(holding.quantity).toBe(2);

  expect(
    await Order.countDocuments({ userId: testUser._id })
  ).toBe(1);

  expect(
    await Ledger.countDocuments({ userId: testUser._id })
  ).toBe(1);
});



test('does not allow concurrent SELL orders to oversell holdings', async () => {
  // Give the user exactly 3 INFY shares.
  await Holding.create({
    userId: testUser._id,
    symbol: 'INFY',
    quantity: 3,
    averagePricePaise: 101540,
  });

  // Both requests try to sell 2 shares.
  const results = await Promise.allSettled([
    executeOrder({
      userId: testUser._id,
      symbol: 'INFY',
      side: 'SELL',
      quantity: 2,
    }),
    executeOrder({
      userId: testUser._id,
      symbol: 'INFY',
      side: 'SELL',
      quantity: 2,
    }),
  ]);

  const successfulOrders = results.filter(
    (result) => result.status === 'fulfilled'
  );

  const failedOrders = results.filter(
    (result) => result.status === 'rejected'
  );

  // Exactly one SELL should succeed.
  expect(successfulOrders).toHaveLength(1);
  expect(failedOrders).toHaveLength(1);

  // The user must retain exactly 1 share.
  const holding = await Holding.findOne({
    userId: testUser._id,
    symbol: 'INFY',
  });

  expect(holding.quantity).toBe(1);

  // Only one order and ledger entry should exist.
  expect(
    await Order.countDocuments({ userId: testUser._id })
  ).toBe(1);

  expect(
    await Ledger.countDocuments({ userId: testUser._id })
  ).toBe(1);

  // Selling 2 shares should credit exactly ₹2,030.80.
  const account = await Account.findOne({
    userId: testUser._id,
  });

  expect(account.availableBalance).toBe(10000000 + 203080);
});

test('rejects an order request without authentication', async () => {
  const response = await request(app)
    .post('/api/orders')
    .send({
      symbol: 'INFY',
      side: 'BUY',
      quantity: 1,
    });

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
});

test('executes a BUY order through the authenticated API', async () => {
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({
      email: testUser.email,
      password: 'TestPassword123',
    });

  expect(loginResponse.status).toBe(200);

  const authCookie = (loginResponse.headers['set-cookie'] ?? [])
    .find(cookie => cookie.startsWith('tark_token='));

  expect(authCookie).toBeDefined();

  const response = await request(app)
    .post('/api/orders')
    .set('Cookie', authCookie.split(';')[0])
    .send({
      symbol: 'INFY',
      side: 'BUY',
      quantity: 1,
    });

  expect(response.status).toBe(201);
  expect(response.body.success).toBe(true);
  expect(response.body.message).toBe('Order executed successfully');

  const order = await Order.findOne({
    userId: testUser._id,
    symbol: 'INFY',
  });

  expect(order).not.toBeNull();
  expect(order.side).toBe('BUY');
  expect(order.quantity).toBe(1);

  const holding = await Holding.findOne({
    userId: testUser._id,
    symbol: 'INFY',
  });

  expect(holding).not.toBeNull();
  expect(holding.quantity).toBe(1);
});

test('executes a SELL order through the authenticated API', async () => {
  // 1. Give the user 3 INFY shares to sell.
  await Holding.create({
    userId: testUser._id,
    symbol: 'INFY',
    quantity: 3,
    averagePricePaise: 101540,
  });

  // 2. Log in to obtain the authentication cookie.
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({
      email: testUser.email,
      password: 'TestPassword123',
    });

  expect(loginResponse.status).toBe(200);

  // 3. Extract the authentication cookie.
  const authCookie = (loginResponse.headers['set-cookie'] ?? [])
    .find(cookie => cookie.startsWith('tark_token='));

  expect(authCookie).toBeDefined();

  // 4. Send the SELL request to the actual API.
  const response = await request(app)
    .post('/api/orders')
    .set('Cookie', authCookie.split(';')[0])
    .send({
      symbol: 'INFY',
      side: 'SELL',
      quantity: 1,
    });

  // 5. Verify the HTTP response.
  expect(response.status).toBe(201);
  expect(response.body.success).toBe(true);
  expect(response.body.message).toBe('Order executed successfully');

  // 6. Verify that the holding decreased from 3 shares to 2.
  const holding = await Holding.findOne({
    userId: testUser._id,
    symbol: 'INFY',
  });

  expect(holding).not.toBeNull();
  expect(holding.quantity).toBe(2);

  // 7. Verify that the account received the sale proceeds.
  const updatedAccount = await Account.findOne({
    userId: testUser._id,
  });

  expect(updatedAccount.availableBalance).toBe(10101540);

  // 8. Verify that the SELL order was saved.
  const order = await Order.findOne({
    userId: testUser._id,
    symbol: 'INFY',
    side: 'SELL',
  });

  expect(order).not.toBeNull();
  expect(order.quantity).toBe(1);
  expect(order.status).toBe('EXECUTED');
});

test('rejects an order with zero quantity', async () => {
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({
      email: testUser.email,
      password: 'TestPassword123',
    });

  expect(loginResponse.status).toBe(200);

  const authCookie = (loginResponse.headers['set-cookie'] ?? [])
    .find(cookie => cookie.startsWith('tark_token='));

  expect(authCookie).toBeDefined();

  const response = await request(app)
    .post('/api/orders')
    .set('Cookie', authCookie.split(';')[0])
    .send({
      symbol: 'INFY',
      side: 'BUY',
      quantity: 0,
    });

  expect(response.status).toBe(400);
});

test('rejects an order with a fractional quantity', async () => {
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({
      email: testUser.email,
      password: 'TestPassword123',
    });

  expect(loginResponse.status).toBe(200);

  const authCookie = (loginResponse.headers['set-cookie'] ?? [])
    .find(cookie => cookie.startsWith('tark_token='));

  expect(authCookie).toBeDefined();

  const response = await request(app)
    .post('/api/orders')
    .set('Cookie', authCookie.split(';')[0])
    .send({
      symbol: 'INFY',
      side: 'BUY',
      quantity: 1.5,
    });

  expect(response.status).toBe(400);
});

test('rejects an invalid order side', async () => {
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({
      email: testUser.email,
      password: 'TestPassword123',
    });

  expect(loginResponse.status).toBe(200);

  const authCookie = (loginResponse.headers['set-cookie'] ?? [])
    .find(cookie => cookie.startsWith('tark_token='));

  expect(authCookie).toBeDefined();

  const response = await request(app)
    .post('/api/orders')
    .set('Cookie', authCookie.split(';')[0])
    .send({
      symbol: 'INFY',
      side: 'HOLD',
      quantity: 1,
    });

  expect(response.status).toBe(400);
});

test('rejects an order when the stock symbol is missing', async () => {
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({
      email: testUser.email,
      password: 'TestPassword123',
    });

  expect(loginResponse.status).toBe(200);

  const authCookie = (loginResponse.headers['set-cookie'] ?? [])
    .find(cookie => cookie.startsWith('tark_token='));

  expect(authCookie).toBeDefined();

  const response = await request(app)
    .post('/api/orders')
    .set('Cookie', authCookie.split(';')[0])
    .send({
      side: 'BUY',
      quantity: 1,
    });

  expect(response.status).toBe(400);
});

test('rejects unexpected fields in an order request', async () => {
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({
      email: testUser.email,
      password: 'TestPassword123',
    });

  expect(loginResponse.status).toBe(200);

  const authCookie = (loginResponse.headers['set-cookie'] ?? [])
    .find(cookie => cookie.startsWith('tark_token='));

  expect(authCookie).toBeDefined();

  const response = await request(app)
    .post('/api/orders')
    .set('Cookie', authCookie.split(';')[0])
    .send({
      symbol: 'INFY',
      side: 'BUY',
      quantity: 1,
      availableBalance: 999999999,
    });

  expect(response.status).toBe(400);

  // Verify that the invalid request did not create an order.
  const orderCount = await Order.countDocuments({
    userId: testUser._id,
  });

  expect(orderCount).toBe(0);
});

});


