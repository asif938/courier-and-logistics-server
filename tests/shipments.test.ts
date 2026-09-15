import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { stripe } from '../src/config/stripe';
import { cleanupTestData, testPrisma } from './cleanup';
import { type AuthedUser, api, authHeader, loginAs, SEEDED, uniqueEmail } from './helpers';

let admin: AuthedUser;
let customer: AuthedUser;
let nyZoneId: string;
let chiZoneId: string;
let pickupAddressId: string;
let deliveryAddressId: string;

async function findZoneIdByName(user: AuthedUser, name: string): Promise<string> {
  const res = await api.get('/api/v1/zones').set(authHeader(user));
  const zone = res.body.data.zones.find((z: { name: string }) => z.name === name);
  if (!zone) throw new Error(`Zone not found: ${name}`);
  return zone.id;
}

async function createShipment(user: AuthedUser, weightKg = 2) {
  const res = await api.post('/api/v1/shipments').set(authHeader(user)).send({
    pickupAddressId,
    deliveryAddressId,
    parcelWeightKg: weightKg,
  });
  return res;
}

async function payForShipment(user: AuthedUser, shipmentId: string) {
  const initiate = await api
    .post('/api/v1/payments/initiate')
    .set(authHeader(user))
    .send({ shipmentId });
  expect(initiate.status).toBe(201);

  const payload = JSON.stringify({
    id: `evt_test_${Date.now()}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: initiate.body.data.payment.stripeSessionId,
        payment_intent: `pi_test_${Date.now()}`,
      },
    },
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: env.stripeWebhookSecret,
  });

  const webhook = await api
    .post('/api/v1/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', signature)
    .send(payload);
  expect(webhook.status).toBe(200);

  return initiate.body.data.payment.id;
}

beforeAll(async () => {
  admin = await loginAs(SEEDED.admin.email, SEEDED.admin.password);

  const email = uniqueEmail('shipments');
  await api
    .post('/api/v1/auth/register')
    .send({ name: 'Shipment Tester', email, password: 'Passw0rd1' });
  customer = await loginAs(email, 'Passw0rd1');

  nyZoneId = await findZoneIdByName(admin, 'New York Metro');
  chiZoneId = await findZoneIdByName(admin, 'Chicago Metro');

  const pickup = await api.post('/api/v1/users/me/addresses').set(authHeader(customer)).send({
    addressLine: '1 Test Pickup St',
    city: 'New York',
    zoneId: nyZoneId,
    contactName: 'Shipment Tester',
    contactPhone: '5550001111',
  });
  pickupAddressId = pickup.body.data.address.id;

  const delivery = await api.post('/api/v1/users/me/addresses').set(authHeader(customer)).send({
    addressLine: '1 Test Delivery Ave',
    city: 'Chicago',
    zoneId: chiZoneId,
    contactName: 'Recipient',
    contactPhone: '5550002222',
  });
  deliveryAddressId = delivery.body.data.address.id;
});

afterAll(async () => {
  await cleanupTestData();
  await testPrisma.$disconnect();
});

describe('shipment creation & validation', () => {
  it('creates a shipment with a computed price', async () => {
    const res = await createShipment(customer);
    expect(res.status).toBe(201);
    expect(res.body.data.shipment.status).toBe('CREATED');
    expect(Number(res.body.data.shipment.priceAmount)).toBeGreaterThan(0);
  });

  it('rejects identical pickup and delivery addresses', async () => {
    const res = await api.post('/api/v1/shipments').set(authHeader(customer)).send({
      pickupAddressId,
      deliveryAddressId: pickupAddressId,
      parcelWeightKg: 1,
    });
    expect(res.status).toBe(400);
  });

  it('rejects a non-positive weight', async () => {
    const res = await api.post('/api/v1/shipments').set(authHeader(customer)).send({
      pickupAddressId,
      deliveryAddressId,
      parcelWeightKg: 0,
    });
    expect(res.status).toBe(400);
  });

  it('auto-attributes organizationId for an org-member customer', async () => {
    const org = await testPrisma.organization.findFirst({ where: { name: 'Acme Retail Co.' } });
    if (!org) throw new Error('Seed organization not found');

    const orgCustomerEmail = uniqueEmail('org-member');
    await api
      .post('/api/v1/auth/register')
      .send({ name: 'Org Member', email: orgCustomerEmail, password: 'Passw0rd1' });
    await testPrisma.user.update({
      where: { email: orgCustomerEmail },
      data: { organizationId: org.id },
    });
    const orgCustomer = await loginAs(orgCustomerEmail, 'Passw0rd1');

    const pickup = await api.post('/api/v1/users/me/addresses').set(authHeader(orgCustomer)).send({
      addressLine: '1 Org St',
      city: 'New York',
      zoneId: nyZoneId,
      contactName: 'Org Member',
      contactPhone: '5550003333',
    });
    const delivery = await api
      .post('/api/v1/users/me/addresses')
      .set(authHeader(orgCustomer))
      .send({
        addressLine: '1 Org Delivery Ave',
        city: 'Chicago',
        zoneId: chiZoneId,
        contactName: 'Org Recipient',
        contactPhone: '5550004444',
      });

    const res = await api.post('/api/v1/shipments').set(authHeader(orgCustomer)).send({
      pickupAddressId: pickup.body.data.address.id,
      deliveryAddressId: delivery.body.data.address.id,
      parcelWeightKg: 1,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.shipment.organizationId).toBe(org.id);
  });
});

describe('payment gate', () => {
  it('blocks pickup-request until the shipment is paid, then unblocks it', async () => {
    const created = await createShipment(customer);
    const shipmentId = created.body.data.shipment.id;

    const blocked = await api
      .post(`/api/v1/shipments/${shipmentId}/pickup-request`)
      .set(authHeader(customer));
    expect(blocked.status).toBe(409);

    await payForShipment(customer, shipmentId);

    const allowed = await api
      .post(`/api/v1/shipments/${shipmentId}/pickup-request`)
      .set(authHeader(customer));
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.shipment.status).toBe('PICKUP_SCHEDULED');
  });

  it('rejects paying twice for the same shipment', async () => {
    const created = await createShipment(customer);
    const shipmentId = created.body.data.shipment.id;
    await payForShipment(customer, shipmentId);

    const secondAttempt = await api
      .post('/api/v1/payments/initiate')
      .set(authHeader(customer))
      .send({ shipmentId });
    expect(secondAttempt.status).toBe(409);
  });

  it('rejects a webhook with an invalid signature', async () => {
    const res = await api
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 't=1,v1=deadbeef')
      .send(JSON.stringify({ type: 'checkout.session.completed' }));
    expect(res.status).toBe(400);
  });
});

describe('courier assignment & status transitions', () => {
  it('runs a shipment through its full lifecycle to DELIVERED', async () => {
    const created = await createShipment(customer);
    const shipmentId = created.body.data.shipment.id;
    await payForShipment(customer, shipmentId);
    await api.post(`/api/v1/shipments/${shipmentId}/pickup-request`).set(authHeader(customer));

    const assigned = await api
      .post(`/api/v1/shipments/${shipmentId}/assign-courier`)
      .set(authHeader(admin))
      .send({});
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.shipment.assignedCourier.name).toBe('Carl Courier');

    const courier = await loginAs(SEEDED.carl.email, SEEDED.carl.password);

    const invalidJump = await api
      .patch(`/api/v1/shipments/${shipmentId}/status`)
      .set(authHeader(courier))
      .send({ status: 'DELIVERED' });
    expect(invalidJump.status).toBe(409);

    const path = [
      'PICKED_UP',
      'AT_ORIGIN_HUB',
      'IN_TRANSIT',
      'AT_DESTINATION_HUB',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ];
    for (const status of path) {
      const res = await api
        .patch(`/api/v1/shipments/${shipmentId}/status`)
        .set(authHeader(courier))
        .send({ status });
      expect(res.status).toBe(200);
    }

    const finalShipment = await api
      .get(`/api/v1/shipments/${shipmentId}`)
      .set(authHeader(customer));
    expect(finalShipment.body.data.shipment.status).toBe('DELIVERED');

    const earnings = await api.get('/api/v1/couriers/me/earnings').set(authHeader(courier));
    expect(
      earnings.body.data.earnings.some(
        (e: { shipment: { trackingNumber: string } }) =>
          e.shipment.trackingNumber === created.body.data.shipment.trackingNumber,
      ),
    ).toBe(true);

    const cancelDelivered = await api
      .post(`/api/v1/shipments/${shipmentId}/cancel`)
      .set(authHeader(customer));
    expect(cancelDelivered.status).toBe(409);
  });

  it('requires a reason for a failed delivery attempt and for return-to-sender', async () => {
    const created = await createShipment(customer);
    const shipmentId = created.body.data.shipment.id;
    await payForShipment(customer, shipmentId);
    await api.post(`/api/v1/shipments/${shipmentId}/pickup-request`).set(authHeader(customer));
    await api
      .post(`/api/v1/shipments/${shipmentId}/assign-courier`)
      .set(authHeader(admin))
      .send({});

    const courier = await loginAs(SEEDED.carl.email, SEEDED.carl.password);
    for (const status of [
      'PICKED_UP',
      'AT_ORIGIN_HUB',
      'IN_TRANSIT',
      'AT_DESTINATION_HUB',
      'OUT_FOR_DELIVERY',
    ]) {
      await api.patch(`/api/v1/shipments/${shipmentId}/status`).set(authHeader(courier)).send({
        status,
      });
    }

    const noReason = await api
      .patch(`/api/v1/shipments/${shipmentId}/status`)
      .set(authHeader(courier))
      .send({ status: 'FAILED_DELIVERY_ATTEMPT' });
    expect(noReason.status).toBe(400);

    const withReason = await api
      .patch(`/api/v1/shipments/${shipmentId}/status`)
      .set(authHeader(courier))
      .send({ status: 'FAILED_DELIVERY_ATTEMPT', note: 'Recipient not home' });
    expect(withReason.status).toBe(200);

    await api.patch(`/api/v1/shipments/${shipmentId}/status`).set(authHeader(courier)).send({
      status: 'OUT_FOR_DELIVERY',
    });
    await api.patch(`/api/v1/shipments/${shipmentId}/status`).set(authHeader(courier)).send({
      status: 'FAILED_DELIVERY_ATTEMPT',
      note: 'Attempt 2',
    });

    const returnNoReason = await api
      .patch(`/api/v1/shipments/${shipmentId}/status`)
      .set(authHeader(courier))
      .send({ status: 'RETURN_TO_SENDER' });
    expect(returnNoReason.status).toBe(400);

    const returnWithReason = await api
      .patch(`/api/v1/shipments/${shipmentId}/status`)
      .set(authHeader(courier))
      .send({ status: 'RETURN_TO_SENDER', note: 'Could not deliver after 2 attempts' });
    expect(returnWithReason.status).toBe(200);
    expect(returnWithReason.body.data.shipment.returnReason).toBe(
      'Could not deliver after 2 attempts',
    );
  });

  it('blocks a hub transfer while the shipment has not been picked up', async () => {
    const created = await createShipment(customer);
    const shipmentId = created.body.data.shipment.id;

    const hubs = await api.get('/api/v1/hubs').set(authHeader(admin));
    const [hubA, hubB] = hubs.body.data.hubs;

    const res = await api
      .post(`/api/v1/shipments/${shipmentId}/hub-transfer`)
      .set(authHeader(admin))
      .send({ fromHubId: hubA.id, toHubId: hubB.id });
    expect(res.status).toBe(409);
  });
});

describe('search & pagination', () => {
  it('finds a shipment by tracking number via search', async () => {
    const created = await createShipment(customer);
    const trackingNumber = created.body.data.shipment.trackingNumber;

    const res = await api
      .get(`/api/v1/shipments/search?q=${trackingNumber}`)
      .set(authHeader(customer));
    expect(res.status).toBe(200);
    expect(
      res.body.data.shipments.some(
        (s: { trackingNumber: string }) => s.trackingNumber === trackingNumber,
      ),
    ).toBe(true);
  });

  it('paginates the shipment list', async () => {
    await createShipment(customer);
    await createShipment(customer);

    const res = await api.get('/api/v1/shipments?page=1&limit=1').set(authHeader(customer));
    expect(res.status).toBe(200);
    expect(res.body.data.meta.limit).toBe(1);
    expect(res.body.data.shipments.length).toBe(1);
  });
});
