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
const { default: Watchlist } = await import(
  '../src/modules/watchlists/watchlist.model.js'
);

let testUser;
let authCookie;
let otherUser;

beforeAll(async () => {
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  const email = `watchlist-test-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@example.com`;

  testUser = await User.create({
    name: 'Watchlist Test User',
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
    await Watchlist.deleteMany({ userId: testUser._id });
    await Account.deleteMany({ userId: testUser._id });
    await User.deleteOne({ _id: testUser._id });
  }

  if (otherUser) {
    await Watchlist.deleteMany({ userId: otherUser._id });
    await Account.deleteMany({ userId: otherUser._id });
    await User.deleteOne({ _id: otherUser._id });
  }

  testUser = null;
  otherUser = null;
  authCookie = null;
});

describe('Watchlist API', () => {
  test('rejects requests without authentication', async () => {
    const response = await request(app).get('/api/watchlist');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('returns an empty watchlist for a new user', async () => {
    const response = await request(app)
      .get('/api/watchlist')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(0);
    expect(response.body.stocks).toEqual([]);
  });

  test('adds a valid stock to the watchlist', async () => {
    const response = await request(app)
      .post('/api/watchlist')
      .set('Cookie', authCookie)
      .send({ symbol: 'TCS' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.stock.symbol).toBe('TCS');

    const watchlist = await Watchlist.findOne({
      userId: testUser._id,
    });

    expect(watchlist.symbols).toContain('TCS');
  });

  test('normalizes lowercase stock symbols to uppercase', async () => {
    const response = await request(app)
      .post('/api/watchlist')
      .set('Cookie', authCookie)
      .send({ symbol: 'tcs' });

    expect(response.status).toBe(201);

    const watchlist = await Watchlist.findOne({
      userId: testUser._id,
    });

    expect(watchlist.symbols).toContain('TCS');
  });

  test('returns saved stocks when retrieving the watchlist', async () => {
    await Watchlist.create({
      userId: testUser._id,
      symbols: ['TCS', 'INFY'],
    });

    const response = await request(app)
      .get('/api/watchlist')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);

    const symbols = response.body.stocks.map((stock) => stock.symbol);

    expect(symbols).toContain('TCS');
    expect(symbols).toContain('INFY');
  });

  test('rejects duplicate stocks', async () => {
    await request(app)
      .post('/api/watchlist')
      .set('Cookie', authCookie)
      .send({ symbol: 'TCS' });

    const response = await request(app)
      .post('/api/watchlist')
      .set('Cookie', authCookie)
      .send({ symbol: 'TCS' });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  test('rejects invalid stock symbols', async () => {
    const response = await request(app)
      .post('/api/watchlist')
      .set('Cookie', authCookie)
      .send({ symbol: 'INVALIDSTOCK' });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  test('rejects a request without a stock symbol', async () => {
    const response = await request(app)
      .post('/api/watchlist')
      .set('Cookie', authCookie)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('removes a saved stock from the watchlist', async () => {
    await Watchlist.create({
      userId: testUser._id,
      symbols: ['TCS', 'INFY'],
    });

    const response = await request(app)
      .delete('/api/watchlist/TCS')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);

    const watchlist = await Watchlist.findOne({
      userId: testUser._id,
    });

    expect(watchlist.symbols).not.toContain('TCS');
    expect(watchlist.symbols).toContain('INFY');
  });

  test('returns 404 when removing a stock that is not saved', async () => {
    const response = await request(app)
      .delete('/api/watchlist/TCS')
      .set('Cookie', authCookie);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  test('does not expose another user watchlist', async () => {
    const email = `other-watchlist-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;

    otherUser = await User.create({
      name: 'Other Watchlist User',
      email,
      password: 'TestPassword123',
    });

    await Watchlist.create({
      userId: otherUser._id,
      symbols: ['INFY'],
    });

    const response = await request(app)
      .get('/api/watchlist')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(0);
    expect(response.body.stocks).toEqual([]);
  });

  test('cannot remove a stock belonging only to another user', async () => {
    const email = `other-remove-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;

    otherUser = await User.create({
      name: 'Other Watchlist User',
      email,
      password: 'TestPassword123',
    });

    await Watchlist.create({
      userId: otherUser._id,
      symbols: ['TCS'],
    });

    const response = await request(app)
      .delete('/api/watchlist/TCS')
      .set('Cookie', authCookie);

    expect(response.status).toBe(404);

    const otherWatchlist = await Watchlist.findOne({
      userId: otherUser._id,
    });

    expect(otherWatchlist.symbols).toContain('TCS');
  });
});