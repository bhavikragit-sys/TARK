import dotenv from "dotenv";

// Load the dedicated test environment first.
dotenv.config({ path: ".env.test", override: true });

// Safety guard: tests may only use tark_test.
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error("MONGODB_URI is missing from .env.test");
}

const databaseName = new URL(mongoUri).pathname.replace(/^\/+/, "");

if (databaseName !== "tark_test") {
  throw new Error(
    `Unsafe test database "${databaseName}". Expected "tark_test".`,
  );
}

// Import only after loading and validating the test environment.
const { default: mongoose } = await import("mongoose");
const { default: request } = await import("supertest");
const { default: app } = await import("../src/app.js");
const { default: User } = await import("../src/modules/users/user.model.js");
const { default: Account } =
  await import("../src/modules/accounts/account.model.js");

describe("Authentication API", () => {
  // Track only the emails created by these tests.
  const createdEmails = new Set();

  beforeAll(async () => {
  await mongoose.connect(mongoUri);
}, 15000);

  // Clean up only test users and their associated trading accounts.
  afterEach(async () => {
    if (createdEmails.size === 0) return;

    const emails = [...createdEmails];
    createdEmails.clear();

    const users = await User.find({
      email: { $in: emails },
    }).select("_id");

    const userIds = users.map((user) => user._id);

    if (userIds.length > 0) {
      await Account.deleteMany({
        userId: { $in: userIds },
      });
    }

    await User.deleteMany({
      email: { $in: emails },
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  test("rejects registration with an invalid email", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Test User",
      email: "not-an-email",
      password: "TestPassword123",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test("rejects registration with a short password", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test User",
        email: `short-${Date.now()}@example.com`,
        password: "123",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test("rejects access to the current-user endpoint without authentication", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
  test("rejects an invalid authentication token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", "tark_token=invalid.fake.token");

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  });

  test("rejects login with an incorrect password", async () => {
    const email = `wrong-password-${Date.now()}@example.com`;

    const response = await request(app).post("/api/auth/login").send({
      email,
      password: "WrongPassword123",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid email or password",
    });
  });

  test("logs in a registered user with valid credentials", async () => {
    const email = `login-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;

    const password = "TestPassword123";

    // Register a user first so we have valid credentials.
    const registrationResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Login Test User",
        email,
        password,
      });

    expect(registrationResponse.status).toBe(201);

    // Track this user so afterEach cleans up their test data.
    createdEmails.add(email);

    // Attempt to log in with the correct credentials.
    const loginResponse = await request(app).post("/api/auth/login").send({
      email,
      password,
    });

    expect(loginResponse.status).toBe(200);

    expect(loginResponse.body.success).toBe(true);

    expect(loginResponse.body.user).toMatchObject({
      name: "Login Test User",
      email,
    });

    // Password information must never be returned.
    expect(loginResponse.body.user).not.toHaveProperty("password");
    expect(loginResponse.body.user).not.toHaveProperty("passwordHash");

    // A successful login should set the authentication cookie.
    const cookies = loginResponse.headers["set-cookie"] ?? [];

    const authCookie = cookies.find((cookie) =>
      cookie.startsWith("tark_token="),
    );

    expect(authCookie).toBeDefined();
    expect(authCookie).toMatch(/httponly/i);
  });
  test("returns the current user when authenticated", async () => {
    const email = `me-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;

    const password = "TestPassword123";

    // Register a new test user.
    const registrationResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Current User Test",
        email,
        password,
      });

    expect(registrationResponse.status).toBe(201);

    // Track the user for cleanup.
    createdEmails.add(email);

    // Log in to obtain a fresh authentication cookie.
    const loginResponse = await request(app).post("/api/auth/login").send({
      email,
      password,
    });

    expect(loginResponse.status).toBe(200);

    const cookies = loginResponse.headers["set-cookie"] ?? [];

    const authCookie = cookies.find((cookie) =>
      cookie.startsWith("tark_token="),
    );

    expect(authCookie).toBeDefined();

    // Send the cookie to the protected endpoint.
    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Cookie", authCookie.split(";")[0]);

    expect(meResponse.status).toBe(200);

    expect(meResponse.body.success).toBe(true);

    expect(meResponse.body.user).toMatchObject({
      name: "Current User Test",
      email,
    });

    expect(meResponse.body.user).not.toHaveProperty("password");
    expect(meResponse.body.user).not.toHaveProperty("passwordHash");
  });
  test("logs out a user by clearing the authentication cookie", async () => {
    const response = await request(app).post("/api/auth/logout");

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      success: true,
      message: "Logout successful",
    });

    // Verify that the response clears the authentication cookie.
    const cookies = response.headers["set-cookie"] ?? [];

    const authCookie = cookies.find((cookie) =>
      cookie.startsWith("tark_token="),
    );

    expect(authCookie).toBeDefined();

    // An expired cookie or a zero max-age instructs the browser to remove it.
    expect(authCookie).toMatch(/expires=/i);
    // The cookie should have an empty value and an expiration date in the past.
    expect(authCookie).toMatch(/^tark_token=;/i);
    expect(authCookie).toMatch(/expires=Thu, 01 Jan 1970/i);
    expect(authCookie).toMatch(/httponly/i);
  });
  test("prevents access to protected routes after logout", async () => {
    const email = `logout-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;

    const password = "TestPassword123";

    // 1. Register a test user.
    const registrationResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Logout Flow Test",
        email,
        password,
      });

    expect(registrationResponse.status).toBe(201);

    // Track this user so afterEach cleans up its test data.
    createdEmails.add(email);

    // 2. Log in and obtain an authentication cookie.
    const loginResponse = await request(app).post("/api/auth/login").send({
      email,
      password,
    });

    expect(loginResponse.status).toBe(200);

    const cookies = loginResponse.headers["set-cookie"] ?? [];

    const authCookie = cookies.find((cookie) =>
      cookie.startsWith("tark_token="),
    );

    expect(authCookie).toBeDefined();

    const sessionCookie = authCookie.split(";")[0];

    // 3. Verify the cookie grants access before logout.
    const beforeLogoutResponse = await request(app)
      .get("/api/auth/me")
      .set("Cookie", sessionCookie);

    expect(beforeLogoutResponse.status).toBe(200);
    expect(beforeLogoutResponse.body.user.email).toBe(email);

    // 4. Log out.
    const logoutResponse = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", sessionCookie);

    expect(logoutResponse.status).toBe(200);

    // 5. Simulate the browser removing the cookie.
    // Do not send the old cookie again.
    const afterLogoutResponse = await request(app).get("/api/auth/me");

    // 6. Without the cookie, access should be denied.
    expect(afterLogoutResponse.status).toBe(401);
    expect(afterLogoutResponse.body.success).toBe(false);
  });

  test("registers a user and creates their trading account", async () => {
    const email = `register-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;

    createdEmails.add(email);

    const response = await request(app).post("/api/auth/register").send({
      name: "Registration Test",
      email,
      password: "TestPassword123",
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    // The response should contain a safe user profile.
    expect(response.body.user).toMatchObject({
      name: "Registration Test",
      email,
    });

    expect(response.body.user).not.toHaveProperty("password");
    expect(response.body.user).not.toHaveProperty("passwordHash");

    // Registration should establish a login session.
    const cookies = response.headers["set-cookie"] ?? [];

    const authCookie = cookies.find((cookie) =>
      cookie.startsWith("tark_token="),
    );

    expect(authCookie).toBeDefined();
    expect(authCookie).toMatch(/httponly/i);

    // Verify the user was actually saved.
    const savedUser = await User.findOne({ email }).select("+password");

    expect(savedUser).not.toBeNull();
    expect(savedUser.password).not.toBe("TestPassword123");

    // Verify that the linked trading account was created.
    const account = await Account.findOne({
      userId: savedUser._id,
    });

    expect(account).not.toBeNull();
    expect(account.initialBalance).toBe(10000000);
    expect(account.availableBalance).toBe(10000000);
  });

  test("rejects registration when the email already exists", async () => {
    const email = `duplicate-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;

    createdEmails.add(email);

    const firstResponse = await request(app).post("/api/auth/register").send({
      name: "First User",
      email,
      password: "TestPassword123",
    });

    expect(firstResponse.status).toBe(201);

    const secondResponse = await request(app).post("/api/auth/register").send({
      name: "Second User",
      email,
      password: "AnotherPassword123",
    });

    expect(secondResponse.status).toBe(409);

    expect(secondResponse.body).toEqual({
      success: false,
      message: "An account with this email already exists",
    });

    // There should still be only one user for this email.
    const userCount = await User.countDocuments({ email });

    expect(userCount).toBe(1);
  });
});
