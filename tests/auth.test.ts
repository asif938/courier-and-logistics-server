import { afterAll, describe, expect, it } from 'vitest';
import { cleanupTestData, testPrisma } from './cleanup';
import { api, SEEDED, uniqueEmail } from './helpers';

afterAll(async () => {
  await cleanupTestData();
  await testPrisma.$disconnect();
});

describe('POST /auth/register', () => {
  it('registers a new customer successfully', async () => {
    const email = uniqueEmail('register');
    const res = await api
      .post('/api/v1/auth/register')
      .send({ name: 'Test User', email, password: 'Passw0rd1' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.role).toBe('CUSTOMER');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email with 409', async () => {
    const email = uniqueEmail('dup');
    const first = await api
      .post('/api/v1/auth/register')
      .send({ name: 'First User', email, password: 'Passw0rd1' });
    expect(first.status).toBe(201);

    const res = await api
      .post('/api/v1/auth/register')
      .send({ name: 'Second User', email, password: 'Passw0rd1' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects an invalid email with a structured validation error', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .send({ name: 'Test', email: 'not-an-email', password: 'Passw0rd1' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.some((e: { field: string }) => e.field === 'email')).toBe(true);
  });

  it('rejects a weak password', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .send({ name: 'Test', email: uniqueEmail('weak'), password: 'weak' });

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e: { field: string }) => e.field === 'password')).toBe(true);
  });

  it('rejects an attempt to self-register as ADMIN', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .send({ name: 'Test', email: uniqueEmail('admin'), password: 'Passw0rd1', role: 'ADMIN' });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('logs in with correct credentials', async () => {
    const res = await api.post('/api/v1/auth/login').send(SEEDED.alice);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('rejects an incorrect password', async () => {
    const res = await api
      .post('/api/v1/auth/login')
      .send({ email: SEEDED.alice.email, password: 'WrongPassword1' });
    expect(res.status).toBe(401);
  });

  it('rejects a non-existent email', async () => {
    const res = await api
      .post('/api/v1/auth/login')
      .send({ email: 'nobody-here@example.com', password: 'Passw0rd1' });
    expect(res.status).toBe(401);
  });

  it('rejects a missing password with a validation error', async () => {
    const res = await api.post('/api/v1/auth/login').send({ email: SEEDED.alice.email });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/refresh-token', () => {
  it('rotates the refresh token and rejects reuse of the old one', async () => {
    const login = await api.post('/api/v1/auth/login').send(SEEDED.bob);
    const originalRefreshToken = login.body.data.refreshToken;

    const refreshed = await api
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: originalRefreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.refreshToken).not.toBe(originalRefreshToken);

    const reused = await api
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: originalRefreshToken });
    expect(reused.status).toBe(401);
  });

  it('rejects a garbage refresh token', async () => {
    const res = await api.post('/api/v1/auth/refresh-token').send({ refreshToken: 'garbage' });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token', async () => {
    const login = await api.post('/api/v1/auth/login').send(SEEDED.carl);
    const { refreshToken } = login.body.data;

    const logout = await api.post('/api/v1/auth/logout').send({ refreshToken });
    expect(logout.status).toBe(200);

    const refreshAfterLogout = await api.post('/api/v1/auth/refresh-token').send({ refreshToken });
    expect(refreshAfterLogout.status).toBe(401);
  });
});

describe('POST /auth/google', () => {
  it('rejects an invalid Google ID token cleanly', async () => {
    const res = await api.post('/api/v1/auth/google').send({ idToken: 'not-a-real-jwt-token' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects a missing idToken with a validation error', async () => {
    const res = await api.post('/api/v1/auth/google').send({});
    expect(res.status).toBe(400);
  });
});
