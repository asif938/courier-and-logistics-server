import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupTestData, testPrisma } from './cleanup';
import { type AuthedUser, api, authHeader, loginAs, SEEDED } from './helpers';

let admin: AuthedUser;
let customer: AuthedUser;
let courier: AuthedUser;

beforeAll(async () => {
  admin = await loginAs(SEEDED.admin.email, SEEDED.admin.password);
  customer = await loginAs(SEEDED.alice.email, SEEDED.alice.password);
  courier = await loginAs(SEEDED.carl.email, SEEDED.carl.password);
});

afterAll(async () => {
  await cleanupTestData();
  await testPrisma.$disconnect();
});

describe('unauthenticated access', () => {
  const protectedGetRoutes = [
    '/api/v1/users/me',
    '/api/v1/shipments',
    '/api/v1/admin/users',
    '/api/v1/couriers/me/earnings',
    '/api/v1/notifications',
    '/api/v1/payments',
  ];

  it.each(protectedGetRoutes)('returns 401 for GET %s with no token', async (path) => {
    const res = await api.get(path);
    expect(res.status).toBe(401);
  });
});

describe('customer role boundaries', () => {
  it('is forbidden from admin-only zone creation', async () => {
    const res = await api
      .post('/api/v1/zones')
      .set(authHeader(customer))
      .send({ name: 'Should Not Exist', city: 'Nowhere' });
    expect(res.status).toBe(403);
  });

  it('is forbidden from the admin user list', async () => {
    const res = await api.get('/api/v1/admin/users').set(authHeader(customer));
    expect(res.status).toBe(403);
  });

  it('is forbidden from the admin dashboard stats', async () => {
    const res = await api.get('/api/v1/admin/dashboard-stats').set(authHeader(customer));
    expect(res.status).toBe(403);
  });

  it('is forbidden from courier earnings', async () => {
    const res = await api.get('/api/v1/couriers/me/earnings').set(authHeader(customer));
    expect(res.status).toBe(403);
  });

  it('is forbidden from assigning a courier to a shipment', async () => {
    const res = await api
      .post('/api/v1/shipments/cnonexistentid000000000000/assign-courier')
      .set(authHeader(customer))
      .send({});
    expect(res.status).toBe(403);
  });
});

describe('courier role boundaries', () => {
  it('is forbidden from creating a shipment', async () => {
    const res = await api
      .post('/api/v1/shipments')
      .set(authHeader(courier))
      .send({ pickupAddressId: 'x', deliveryAddressId: 'y', parcelWeightKg: 1 });
    expect(res.status).toBe(403);
  });

  it('is forbidden from adding a saved address (customer-only)', async () => {
    const res = await api
      .post('/api/v1/users/me/addresses')
      .set(authHeader(courier))
      .send({ addressLine: 'X', city: 'Y', contactName: 'Z', contactPhone: '1234567' });
    expect(res.status).toBe(403);
  });

  it('is forbidden from the admin audit log', async () => {
    const res = await api.get('/api/v1/admin/audit-logs').set(authHeader(courier));
    expect(res.status).toBe(403);
  });
});

describe('admin access', () => {
  it('can access the user list', async () => {
    const res = await api.get('/api/v1/admin/users').set(authHeader(admin));
    expect(res.status).toBe(200);
  });

  it('can access dashboard stats', async () => {
    const res = await api.get('/api/v1/admin/dashboard-stats').set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalShipments');
  });

  it('cannot change its own role', async () => {
    const res = await api
      .patch(`/api/v1/admin/users/${admin.userId}/role`)
      .set(authHeader(admin))
      .send({ role: 'CUSTOMER' });
    expect(res.status).toBe(400);
  });
});
