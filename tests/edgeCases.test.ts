import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupTestData, testPrisma } from './cleanup';
import { type AuthedUser, api, authHeader, loginAs, SEEDED, uniqueEmail } from './helpers';

let admin: AuthedUser;
let customer: AuthedUser;
let otherCustomer: AuthedUser;
let zoneId: string;

beforeAll(async () => {
  admin = await loginAs(SEEDED.admin.email, SEEDED.admin.password);
  customer = await loginAs(SEEDED.alice.email, SEEDED.alice.password);

  const otherEmail = uniqueEmail('edge-other');
  await api
    .post('/api/v1/auth/register')
    .send({ name: 'Other Customer', email: otherEmail, password: 'Passw0rd1' });
  otherCustomer = await loginAs(otherEmail, 'Passw0rd1');

  const zones = await api.get('/api/v1/zones').set(authHeader(admin));
  zoneId = zones.body.data.zones[0].id;
});

afterAll(async () => {
  await cleanupTestData();
  await testPrisma.$disconnect();
});

describe('duplicate-entry edge cases', () => {
  it('rejects a duplicate zone name with 409', async () => {
    const name = `Test Suite Zone ${Date.now()}`;
    const first = await api
      .post('/api/v1/zones')
      .set(authHeader(admin))
      .send({ name, city: 'Testville' });
    expect(first.status).toBe(201);

    const second = await api
      .post('/api/v1/zones')
      .set(authHeader(admin))
      .send({ name, city: 'Testville' });
    expect(second.status).toBe(409);
  });

  it('rejects a duplicate hub code with 409', async () => {
    const code = `TEST-HUB-${Date.now()}`;
    const payload = {
      code,
      name: `Test Suite Hub ${Date.now()}`,
      address: '1 Test Way',
      zoneId,
    };
    const first = await api.post('/api/v1/hubs').set(authHeader(admin)).send(payload);
    expect(first.status).toBe(201);

    const second = await api.post('/api/v1/hubs').set(authHeader(admin)).send(payload);
    expect(second.status).toBe(409);
  });

  it('rejects a duplicate pricing rule (same route/service/weight-tier) with 409', async () => {
    const payload = {
      originZoneId: zoneId,
      destinationZoneId: zoneId,
      serviceType: 'STANDARD',
      minWeightKg: 900,
      maxWeightKg: 950,
      basePrice: 3.99,
      perKgRate: 0.75,
    };
    const first = await api.post('/api/v1/pricing/rules').set(authHeader(admin)).send(payload);
    expect(first.status).toBe(201);

    const second = await api.post('/api/v1/pricing/rules').set(authHeader(admin)).send(payload);
    expect(second.status).toBe(409);
  });

  it('rejects a duplicate registration email with 409', async () => {
    const email = uniqueEmail('dup-edge');
    const first = await api
      .post('/api/v1/auth/register')
      .send({ name: 'First User', email, password: 'Passw0rd1' });
    expect(first.status).toBe(201);

    const res = await api
      .post('/api/v1/auth/register')
      .send({ name: 'Second User', email, password: 'Passw0rd1' });
    expect(res.status).toBe(409);
  });
});

describe('not-found edge cases', () => {
  const plausibleButMissingId = 'cabsentabsentabsentabsent01';

  it('returns 404 for a shipment that does not exist', async () => {
    const res = await api
      .get(`/api/v1/shipments/${plausibleButMissingId}`)
      .set(authHeader(customer));
    expect(res.status).toBe(404);
  });

  it("returns 404 (not 403) when a customer looks up another customer's shipment", async () => {
    const zonesRes = await api.get('/api/v1/zones').set(authHeader(customer));
    const zone = zonesRes.body.data.zones[0];

    const addrRes = await api
      .post('/api/v1/users/me/addresses')
      .set(authHeader(otherCustomer))
      .send({
        addressLine: '1 Bob St',
        city: 'Testville',
        zoneId: zone.id,
        contactName: 'Bob',
        contactPhone: '5551234567',
      });
    const addr2Res = await api
      .post('/api/v1/users/me/addresses')
      .set(authHeader(otherCustomer))
      .send({
        addressLine: '2 Bob St',
        city: 'Testville',
        zoneId: zone.id,
        contactName: 'Bob',
        contactPhone: '5551234568',
      });

    const shipmentRes = await api.post('/api/v1/shipments').set(authHeader(otherCustomer)).send({
      pickupAddressId: addrRes.body.data.address.id,
      deliveryAddressId: addr2Res.body.data.address.id,
      parcelWeightKg: 1,
    });
    expect(shipmentRes.status).toBe(201);

    const res = await api
      .get(`/api/v1/shipments/${shipmentRes.body.data.shipment.id}`)
      .set(authHeader(customer));
    expect(res.status).toBe(404);
  });

  it('returns 404 for updating a non-existent hub', async () => {
    const res = await api
      .patch(`/api/v1/hubs/${plausibleButMissingId}`)
      .set(authHeader(admin))
      .send({ capacity: 500 });
    expect(res.status).toBe(404);
  });

  it('returns 404 for a non-existent notification', async () => {
    const res = await api
      .patch(`/api/v1/notifications/${plausibleButMissingId}/read`)
      .set(authHeader(customer));
    expect(res.status).toBe(404);
  });

  it('returns 404 for role update on a non-existent user', async () => {
    const res = await api
      .patch(`/api/v1/admin/users/${plausibleButMissingId}/role`)
      .set(authHeader(admin))
      .send({ role: 'CUSTOMER' });
    expect(res.status).toBe(404);
  });
});
