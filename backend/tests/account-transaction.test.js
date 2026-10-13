import dotenv from 'dotenv';
import { jest } from '@jest/globals';

// Load test environment BEFORE importing the app or models.
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

// Import app and models only after loading and checking test configuration.
const { default: mongoose } = await import('mongoose');
const { default: request } = await import('supertest');
const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/modules/users/user.model.js');
const { default: Account } = await import(
  '../src/modules/accounts/account.model.js'
);

describe('Registration transaction rollback', () => {
  let accountCreateSpy;
  let capturedUserId;
  let email;

  beforeAll(async () => {
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(() => {
    capturedUserId = null;
    email = `rollback-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;
  });

  afterEach(() => {
    if (accountCreateSpy) {
      accountCreateSpy.mockRestore();
      accountCreateSpy = null;
    }
  });

  test('rolls back user creation if account creation fails', async () => {
    const originalCreate = Account.create;

    accountCreateSpy = jest
      .spyOn(Account, 'create')
      .mockImplementation(async function (...args) {
        // First, let the account be created inside the transaction.
        const result = await originalCreate.apply(this, args);

        capturedUserId = args[0][0].userId;

        // Simulate a failure AFTER the account write.
        throw new Error('Simulated account creation failure');
      });

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Rollback Test',
        email,
        password: 'TestPassword123',
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: 'Internal Server Error',
    });

    // Both writes should have been rolled back.
    const savedUser = await User.findOne({ email });
    const savedAccount = capturedUserId
      ? await Account.findOne({ userId: capturedUserId })
      : null;

    expect(savedUser).toBeNull();
    expect(savedAccount).toBeNull();
    expect(capturedUserId).not.toBeNull();
  });
});