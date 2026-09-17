import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';

interface RequestSpec {
  name: string;
  method: Method;
  path: string;
  query?: Record<string, string>;
  auth?: string;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
  test?: string[];
  description?: string;
}

function buildUrl(path: string, query?: Record<string, string>) {
  const segments = path.split('/').filter(Boolean);
  const raw = `{{baseUrl}}/${segments.join('/')}${
    query
      ? `?${Object.entries(query)
          .map(([k, v]) => `${k}=${v}`)
          .join('&')}`
      : ''
  }`;
  return {
    raw,
    host: ['{{baseUrl}}'],
    path: segments,
    ...(query ? { query: Object.entries(query).map(([key, value]) => ({ key, value })) } : {}),
  };
}

function requestItem(spec: RequestSpec) {
  const headers = [
    ...(spec.body || spec.rawBody ? [{ key: 'Content-Type', value: 'application/json' }] : []),
    ...Object.entries(spec.headers ?? {}).map(([key, value]) => ({ key, value })),
  ];

  return {
    name: spec.name,
    request: {
      method: spec.method,
      header: headers,
      ...(spec.auth
        ? { auth: { type: 'bearer', bearer: [{ key: 'token', value: spec.auth, type: 'string' }] } }
        : {}),
      url: buildUrl(spec.path, spec.query),
      ...(spec.body !== undefined
        ? {
            body: {
              mode: 'raw',
              raw: JSON.stringify(spec.body, null, 2),
              options: { raw: { language: 'json' } },
            },
          }
        : {}),
      ...(spec.rawBody !== undefined
        ? { body: { mode: 'raw', raw: spec.rawBody, options: { raw: { language: 'json' } } } }
        : {}),
      ...(spec.description ? { description: spec.description } : {}),
    },
    ...(spec.test
      ? { event: [{ listen: 'test', script: { type: 'text/javascript', exec: spec.test } }] }
      : {}),
    response: [],
  };
}

function folder(name: string, items: unknown[], description?: string) {
  return { name, item: items, ...(description ? { description } : {}) };
}

const okTest = (label: string, statuses: number[]) => [
  `pm.test("${label}", function () {`,
  `  pm.expect([${statuses.join(', ')}]).to.include(pm.response.code);`,
  '});',
];

function captureTokens(prefix: string) {
  return [
    `pm.collectionVariables.set('${prefix}AccessToken', pm.response.json().data.accessToken);`,
    `pm.collectionVariables.set('${prefix}RefreshToken', pm.response.json().data.refreshToken);`,
    `pm.collectionVariables.set('${prefix}Id', pm.response.json().data.user.id);`,
    `pm.test("${prefix} login returns tokens", function () {`,
    '  pm.expect(pm.response.json().data.accessToken).to.be.a("string");',
    '});',
  ];
}

function captureField(jsonPath: string, varName: string) {
  const relativePath = jsonPath.replace(/^json\./, '');
  return [`pm.collectionVariables.set('${varName}', pm.response.json().${relativePath});`];
}

const AUTH = {
  admin: '{{adminAccessToken}}',
  customer: '{{customerAccessToken}}',
  courier: '{{courierAccessToken}}',
};

const healthFolder = folder('Health', [
  requestItem({
    name: 'Health Check',
    method: 'GET',
    path: 'health',
    test: okTest('API is healthy', [200, 503]),
    description: 'Verifies the API, database, and (optionally) Redis connectivity.',
  }),
]);

const authFolder = folder(
  'Auth',
  [
    requestItem({
      name: 'Register (throwaway demo customer)',
      method: 'POST',
      path: 'auth/register',
      body: { name: 'Postman Demo User', email: '{{$randomEmail}}', password: 'Passw0rd1' },
      test: [
        ...captureField('json.data.user.email', 'registeredEmail'),
        ...captureField('json.data.user.id', 'registeredUserId'),
        ...okTest('Registration succeeds', [201]),
      ],
      description: 'Registers a new CUSTOMER account. Uses a random email so this can be re-run.',
    }),
    requestItem({
      name: 'Register - duplicate email (409)',
      method: 'POST',
      path: 'auth/register',
      body: { name: 'Duplicate Attempt', email: '{{registeredEmail}}', password: 'Passw0rd1' },
      test: okTest('Duplicate email is rejected', [409]),
    }),
    requestItem({
      name: 'Register - validation error (400)',
      method: 'POST',
      path: 'auth/register',
      body: { name: 'A', email: 'not-an-email', password: 'weak' },
      test: okTest('Invalid payload is rejected', [400]),
    }),
    requestItem({
      name: 'Login - Admin',
      method: 'POST',
      path: 'auth/login',
      body: { email: 'admin@courierlogistics.dev', password: 'Passw0rd!123' },
      test: captureTokens('admin'),
      description: 'Demo admin credentials for evaluation.',
    }),
    requestItem({
      name: 'Login - Customer (Alice)',
      method: 'POST',
      path: 'auth/login',
      body: { email: 'alice@example.com', password: 'Passw0rd!123' },
      test: captureTokens('customer'),
    }),
    requestItem({
      name: 'Login - Courier (Carl)',
      method: 'POST',
      path: 'auth/login',
      body: { email: 'carl@example.com', password: 'Passw0rd!123' },
      test: captureTokens('courier'),
    }),
    requestItem({
      name: 'Login - wrong password (401)',
      method: 'POST',
      path: 'auth/login',
      body: { email: 'alice@example.com', password: 'WrongPassword1' },
      test: okTest('Wrong password is rejected', [401]),
    }),
    requestItem({
      name: 'Google Login (reference - needs a real Google ID token)',
      method: 'POST',
      path: 'auth/google',
      body: { idToken: 'PASTE_A_REAL_GOOGLE_ID_TOKEN_HERE' },
      test: okTest('Rejected without a real token', [401]),
      description:
        'GCP social login. Verify a real Google ID token server-side via google-auth-library. Cannot be demoed with a placeholder token.',
    }),
    requestItem({
      name: 'Refresh Token - Customer',
      method: 'POST',
      path: 'auth/refresh-token',
      body: { refreshToken: '{{customerRefreshToken}}' },
      test: [
        ...captureField('json.data.accessToken', 'customerAccessToken'),
        ...captureField('json.data.refreshToken', 'customerRefreshToken'),
        ...okTest('Token refreshed', [200]),
      ],
      description: 'Rotates the refresh token; the old one is revoked and rejected on reuse.',
    }),
    requestItem({
      name: 'Logout - Customer',
      method: 'POST',
      path: 'auth/logout',
      body: { refreshToken: '{{customerRefreshToken}}' },
      test: okTest('Logged out', [200]),
      description:
        'Revokes the refresh token only; the still-valid access token keeps working for the rest of this collection run.',
    }),
  ],
  'Registration, login (all 3 roles), Google social login, token refresh/rotation, logout.',
);

const usersFolder = folder(
  'Users / Profile',
  [
    requestItem({
      name: 'Get My Profile',
      method: 'GET',
      path: 'users/me',
      auth: AUTH.customer,
      test: okTest('Profile returned', [200]),
    }),
    requestItem({
      name: 'Update My Profile',
      method: 'PATCH',
      path: 'users/me',
      auth: AUTH.customer,
      body: { phone: '+1-212-555-9999' },
      test: okTest('Profile updated', [200]),
    }),
    requestItem({
      name: 'Add Address - Pickup',
      method: 'POST',
      path: 'users/me/addresses',
      auth: AUTH.customer,
      body: {
        label: 'Postman Pickup',
        addressLine: '10 Demo St',
        city: 'New York',
        zoneId: '{{originZoneId}}',
        contactName: 'Alice Customer',
        contactPhone: '+1-212-555-0101',
      },
      test: [
        ...captureField('json.data.address.id', 'pickupAddressId'),
        ...okTest('Address created', [201]),
      ],
    }),
    requestItem({
      name: 'Add Address - Delivery',
      method: 'POST',
      path: 'users/me/addresses',
      auth: AUTH.customer,
      body: {
        label: 'Postman Delivery',
        addressLine: '500 Demo Ave',
        city: 'Chicago',
        zoneId: '{{destinationZoneId}}',
        contactName: 'Recipient Name',
        contactPhone: '+1-312-555-0199',
      },
      test: [
        ...captureField('json.data.address.id', 'deliveryAddressId'),
        ...okTest('Address created', [201]),
      ],
    }),
    requestItem({
      name: 'List My Addresses',
      method: 'GET',
      path: 'users/me/addresses',
      auth: AUTH.customer,
      test: okTest('Addresses returned', [200]),
    }),
  ],
  'CUSTOMER-only saved addresses feed into the Shipments folder below.',
);

const zonesFolder = folder(
  'Zones (reference data)',
  [
    requestItem({
      name: 'List Zones',
      method: 'GET',
      path: 'zones',
      auth: AUTH.customer,
      test: [
        'const json = pm.response.json();',
        "const ny = json.data.zones.find((z) => z.name === 'New York Metro');",
        "const chi = json.data.zones.find((z) => z.name === 'Chicago Metro');",
        "pm.collectionVariables.set('originZoneId', ny ? ny.id : json.data.zones[0].id);",
        "pm.collectionVariables.set('destinationZoneId', chi ? chi.id : json.data.zones[1].id);",
        ...okTest('Zones returned', [200]),
      ],
      description: 'Run this before Users/Shipments so originZoneId/destinationZoneId are set.',
    }),
    requestItem({
      name: 'Create Zone (Admin)',
      method: 'POST',
      path: 'zones',
      auth: AUTH.admin,
      body: { name: 'Postman Demo Zone {{$randomInt}}', city: 'Demo City' },
      test: [...captureField('json.data.zone.id', 'demoZoneId'), ...okTest('Zone created', [201])],
    }),
    requestItem({
      name: 'Create Zone - forbidden for CUSTOMER (403)',
      method: 'POST',
      path: 'zones',
      auth: AUTH.customer,
      body: { name: 'Should Be Rejected', city: 'Nowhere' },
      test: okTest('Non-admin is forbidden', [403]),
    }),
  ],
  'Zones back pricing and courier-matching. originZoneId/destinationZoneId feed the Users and Shipments folders.',
);

const hubsFolder = folder('Hubs (Admin)', [
  requestItem({
    name: 'Create Hub A',
    method: 'POST',
    path: 'hubs',
    auth: AUTH.admin,
    body: {
      code: 'PM-HUB-A-{{$randomInt}}',
      name: 'Postman Demo Hub A',
      address: '1 Demo Way',
      zoneId: '{{demoZoneId}}',
    },
    test: [...captureField('json.data.hub.id', 'hubIdA'), ...okTest('Hub created', [201])],
  }),
  requestItem({
    name: 'Create Hub B',
    method: 'POST',
    path: 'hubs',
    auth: AUTH.admin,
    body: {
      code: 'PM-HUB-B-{{$randomInt}}',
      name: 'Postman Demo Hub B',
      address: '2 Demo Way',
      zoneId: '{{demoZoneId}}',
    },
    test: [...captureField('json.data.hub.id', 'hubIdB'), ...okTest('Hub created', [201])],
  }),
  requestItem({
    name: 'List Hubs',
    method: 'GET',
    path: 'hubs',
    auth: AUTH.customer,
    test: okTest('Hubs returned', [200]),
  }),
  requestItem({
    name: 'Update Hub A',
    method: 'PATCH',
    path: 'hubs/{{hubIdA}}',
    auth: AUTH.admin,
    body: { capacity: 2000 },
    test: okTest('Hub updated', [200]),
  }),
  requestItem({
    name: 'Delete Hub B',
    method: 'DELETE',
    path: 'hubs/{{hubIdB}}',
    auth: AUTH.admin,
    test: okTest('Hub soft-deleted', [200]),
  }),
]);

const pricingFolder = folder('Pricing', [
  requestItem({
    name: 'Get Price Quote',
    method: 'POST',
    path: 'pricing/quote',
    auth: AUTH.customer,
    body: {
      originZoneId: '{{originZoneId}}',
      destinationZoneId: '{{destinationZoneId}}',
      serviceType: 'STANDARD',
      weightKg: 2.5,
    },
    test: okTest('Quote returned', [200]),
  }),
  requestItem({
    name: 'Create Pricing Rule (Admin)',
    method: 'POST',
    path: 'pricing/rules',
    auth: AUTH.admin,
    body: {
      originZoneId: '{{demoZoneId}}',
      destinationZoneId: '{{demoZoneId}}',
      serviceType: 'STANDARD',
      minWeightKg: 900,
      maxWeightKg: 950,
      basePrice: 3.99,
      perKgRate: 0.75,
    },
    test: okTest('Pricing rule created', [201]),
  }),
  requestItem({
    name: 'Create Pricing Rule - duplicate (409)',
    method: 'POST',
    path: 'pricing/rules',
    auth: AUTH.admin,
    body: {
      originZoneId: '{{demoZoneId}}',
      destinationZoneId: '{{demoZoneId}}',
      serviceType: 'STANDARD',
      minWeightKg: 900,
      maxWeightKg: 950,
      basePrice: 3.99,
      perKgRate: 0.75,
    },
    test: okTest('Duplicate rule is rejected', [409]),
  }),
]);

const shipmentsFolder = folder(
  'Shipments',
  [
    requestItem({
      name: 'Create Shipment',
      method: 'POST',
      path: 'shipments',
      auth: AUTH.customer,
      body: {
        pickupAddressId: '{{pickupAddressId}}',
        deliveryAddressId: '{{deliveryAddressId}}',
        parcelWeightKg: 2.5,
        parcelDescription: 'Postman demo parcel',
      },
      test: [
        ...captureField('json.data.shipment.id', 'shipmentId'),
        ...captureField('json.data.shipment.trackingNumber', 'trackingNumber'),
        ...okTest('Shipment created', [201]),
      ],
    }),
    requestItem({
      name: 'Create Shipment - COURIER forbidden (403)',
      method: 'POST',
      path: 'shipments',
      auth: AUTH.courier,
      body: {
        pickupAddressId: '{{pickupAddressId}}',
        deliveryAddressId: '{{deliveryAddressId}}',
        parcelWeightKg: 1,
      },
      test: okTest('Courier cannot create shipments', [403]),
    }),
    requestItem({
      name: 'List My Shipments (paginated)',
      method: 'GET',
      path: 'shipments',
      query: { page: '1', limit: '10', sortBy: 'createdAt', sortOrder: 'desc' },
      auth: AUTH.customer,
      test: okTest('Shipments returned', [200]),
    }),
    requestItem({
      name: 'Search Shipments',
      method: 'GET',
      path: 'shipments/search',
      query: { q: '{{trackingNumber}}' },
      auth: AUTH.customer,
      test: okTest('Search returned', [200]),
    }),
    requestItem({
      name: 'Get Shipment By Id',
      method: 'GET',
      path: 'shipments/{{shipmentId}}',
      auth: AUTH.customer,
      test: okTest('Shipment returned', [200]),
    }),
    requestItem({
      name: 'Get Shipment Tracking Timeline',
      method: 'GET',
      path: 'shipments/{{shipmentId}}/tracking',
      auth: AUTH.customer,
      test: okTest('Tracking timeline returned', [200]),
    }),
    requestItem({
      name: 'Update Shipment (pre-pickup only)',
      method: 'PATCH',
      path: 'shipments/{{shipmentId}}',
      auth: AUTH.customer,
      body: { parcelDescription: 'Updated via Postman' },
      test: okTest('Shipment updated', [200]),
    }),
    requestItem({
      name: 'Request Pickup - blocked, unpaid (409)',
      method: 'POST',
      path: 'shipments/{{shipmentId}}/pickup-request',
      auth: AUTH.customer,
      test: okTest('Payment gate blocks pickup until paid', [409]),
      description:
        'The platform requires payment before pickup is scheduled. Pay via the Payments folder, then retry this call to see it succeed.',
    }),
    requestItem({
      name: 'Cancel Shipment',
      method: 'POST',
      path: 'shipments/{{shipmentId}}/cancel',
      auth: AUTH.customer,
      test: okTest('Cancellable from a pre-pickup state', [200]),
      description: 'Only cancellable from CREATED/PICKUP_SCHEDULED/COURIER_ASSIGNED.',
    }),
    requestItem({
      name: 'Get My Assigned Shipments (Courier)',
      method: 'GET',
      path: 'shipments/my-assigned',
      auth: AUTH.courier,
      test: okTest('Assigned shipments returned', [200]),
    }),
  ],
  'Core shipment CRUD + business actions. The pickup-request call here is expected to return 409 (payment required) — see the End-to-End Demo folder for the full paid happy path.',
);

const couriersFolder = folder('Couriers', [
  requestItem({
    name: 'Get My Earnings',
    method: 'GET',
    path: 'couriers/me/earnings',
    auth: AUTH.courier,
    test: okTest('Earnings returned', [200]),
  }),
  requestItem({
    name: 'Toggle My Availability',
    method: 'PATCH',
    path: 'couriers/me/availability',
    auth: AUTH.courier,
    body: { isAvailable: true },
    test: okTest('Availability updated', [200]),
  }),
]);

const notificationsFolder = folder('Notifications', [
  requestItem({
    name: 'List My Notifications',
    method: 'GET',
    path: 'notifications',
    auth: AUTH.customer,
    test: [
      'const json = pm.response.json();',
      'if (json.data.notifications.length > 0) {',
      "  pm.collectionVariables.set('notificationId', json.data.notifications[0].id);",
      '}',
      ...okTest('Notifications returned', [200]),
    ],
  }),
  requestItem({
    name: 'Mark Notification Read',
    method: 'PATCH',
    path: 'notifications/{{notificationId}}/read',
    auth: AUTH.customer,
    test: okTest('Marked read (or 404 if none exist yet)', [200, 404]),
    description: 'Run the End-to-End Demo folder first to guarantee a notification exists.',
  }),
]);

const paymentsFolder = folder('Payments', [
  requestItem({
    name: 'Initiate Payment (real Stripe Checkout Session)',
    method: 'POST',
    path: 'payments/initiate',
    auth: AUTH.customer,
    body: { shipmentId: '{{shipmentId}}' },
    test: [
      'const json = pm.response.json();',
      'if (pm.response.code === 201) {',
      "  pm.collectionVariables.set('paymentId', json.data.payment.id);",
      "  pm.collectionVariables.set('checkoutUrl', json.data.checkoutUrl);",
      '}',
      ...okTest(
        'Stripe Checkout Session created (or 409 if the demo shipment was already cancelled above)',
        [201, 404, 409],
      ),
    ],
    description:
      'Creates a real Stripe test-mode Checkout Session. Open data.checkoutUrl in a browser and pay with card 4242 4242 4242 4242 to complete it for real.',
  }),
  requestItem({
    name: 'List My Payments',
    method: 'GET',
    path: 'payments',
    auth: AUTH.customer,
    test: okTest('Payments returned', [200]),
  }),
  requestItem({
    name: 'Get Payment By Id',
    method: 'GET',
    path: 'payments/{{paymentId}}',
    auth: AUTH.customer,
    test: okTest('Payment returned (or 404 if none was created above)', [200, 404]),
  }),
  requestItem({
    name: 'Stripe Webhook (called by Stripe, not the client)',
    method: 'POST',
    path: 'payments/webhook',
    rawBody: JSON.stringify(
      {
        id: 'evt_example',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_example', payment_intent: 'pi_example' } },
      },
      null,
      2,
    ),
    headers: { 'Stripe-Signature': 't=1,v1=invalid-without-real-signing' },
    test: okTest('Rejected without a genuine Stripe signature', [400]),
    description:
      'This endpoint is called by Stripe’s servers, not by a Postman user. It verifies the Stripe-Signature header via the raw request body, so this example (an unsigned payload) is expected to fail with 400. Configure a real webhook in the Stripe Dashboard (or use the Stripe CLI: `stripe listen --forward-to localhost:5000/api/v1/payments/webhook`) to exercise it for real.',
  }),
]);

const adminFolder = folder('Admin', [
  requestItem({
    name: 'List Users (paginated, filterable, searchable)',
    method: 'GET',
    path: 'admin/users',
    query: { page: '1', limit: '10' },
    auth: AUTH.admin,
    test: okTest('Users returned', [200]),
  }),
  requestItem({
    name: 'Change User Role',
    method: 'PATCH',
    path: 'admin/users/{{registeredUserId}}/role',
    auth: AUTH.admin,
    body: { role: 'COURIER' },
    test: okTest('Role updated (audit-logged)', [200]),
    description: 'Targets the throwaway account created by "Register" in the Auth folder.',
  }),
  requestItem({
    name: 'Deactivate User',
    method: 'PATCH',
    path: 'admin/users/{{registeredUserId}}/status',
    auth: AUTH.admin,
    body: { isActive: false },
    test: okTest('Status updated (audit-logged)', [200]),
  }),
  requestItem({
    name: 'Reactivate User',
    method: 'PATCH',
    path: 'admin/users/{{registeredUserId}}/status',
    auth: AUTH.admin,
    body: { isActive: true },
    test: okTest('Status updated', [200]),
  }),
  requestItem({
    name: 'Dashboard Stats',
    method: 'GET',
    path: 'admin/dashboard-stats',
    auth: AUTH.admin,
    test: okTest('Stats returned', [200]),
  }),
  requestItem({
    name: 'Audit Logs',
    method: 'GET',
    path: 'admin/audit-logs',
    query: { page: '1', limit: '10' },
    auth: AUTH.admin,
    test: okTest('Audit logs returned', [200]),
  }),
  requestItem({
    name: 'Admin Routes - forbidden for CUSTOMER (403)',
    method: 'GET',
    path: 'admin/users',
    auth: AUTH.customer,
    test: okTest('Non-admin is forbidden', [403]),
  }),
]);

const e2eFolder = folder(
  'End-to-End Demo (full paid lifecycle)',
  [
    requestItem({
      name: '1. Create Shipment',
      method: 'POST',
      path: 'shipments',
      auth: AUTH.customer,
      body: {
        pickupAddressId: '{{pickupAddressId}}',
        deliveryAddressId: '{{deliveryAddressId}}',
        parcelWeightKg: 3,
        parcelDescription: 'Postman E2E demo parcel',
      },
      test: [
        ...captureField('json.data.shipment.id', 'e2eShipmentId'),
        ...okTest('Created', [201]),
      ],
    }),
    requestItem({
      name: '2. Initiate Payment',
      method: 'POST',
      path: 'payments/initiate',
      auth: AUTH.customer,
      body: { shipmentId: '{{e2eShipmentId}}' },
      test: [
        ...captureField('json.data.payment.stripeSessionId', 'e2eStripeSessionId'),
        ...okTest('Checkout session created', [201]),
      ],
    }),
    requestItem({
      name: '3. Complete Checkout In Browser',
      method: 'GET',
      path: 'health',
      test: [
        "console.log('Open the checkoutUrl from step 2 in a browser and pay with card 4242 4242 4242 4242, then continue.');",
      ],
      description:
        'Placeholder step: open the checkoutUrl returned by step 2 in a real browser and complete the Stripe test-mode checkout (card 4242 4242 4242 4242, any future expiry, any CVC) before running step 4.',
    }),
    requestItem({
      name: '4. Request Pickup (now unblocked)',
      method: 'POST',
      path: 'shipments/{{e2eShipmentId}}/pickup-request',
      auth: AUTH.customer,
      test: okTest('Succeeds once Stripe confirms payment via webhook', [200, 409]),
    }),
    requestItem({
      name: '5. Assign Courier (auto-match by zone)',
      method: 'POST',
      path: 'shipments/{{e2eShipmentId}}/assign-courier',
      auth: AUTH.admin,
      body: {},
      test: okTest('Courier assigned', [200, 409]),
    }),
    requestItem({
      name: '6. Courier: Picked Up',
      method: 'PATCH',
      path: 'shipments/{{e2eShipmentId}}/status',
      auth: AUTH.courier,
      body: { status: 'PICKED_UP' },
      test: okTest('Status advanced', [200, 404, 409]),
    }),
    requestItem({
      name: '7. Courier: At Origin Hub',
      method: 'PATCH',
      path: 'shipments/{{e2eShipmentId}}/status',
      auth: AUTH.courier,
      body: { status: 'AT_ORIGIN_HUB' },
      test: okTest('Status advanced', [200, 404, 409]),
    }),
    requestItem({
      name: '8. Courier: In Transit',
      method: 'PATCH',
      path: 'shipments/{{e2eShipmentId}}/status',
      auth: AUTH.courier,
      body: { status: 'IN_TRANSIT' },
      test: okTest('Status advanced', [200, 404, 409]),
    }),
    requestItem({
      name: '9. Courier: At Destination Hub',
      method: 'PATCH',
      path: 'shipments/{{e2eShipmentId}}/status',
      auth: AUTH.courier,
      body: { status: 'AT_DESTINATION_HUB' },
      test: okTest('Status advanced', [200, 404, 409]),
    }),
    requestItem({
      name: '10. Courier: Out For Delivery',
      method: 'PATCH',
      path: 'shipments/{{e2eShipmentId}}/status',
      auth: AUTH.courier,
      body: { status: 'OUT_FOR_DELIVERY' },
      test: okTest('Status advanced', [200, 404, 409]),
    }),
    requestItem({
      name: '11. Courier: Delivered',
      method: 'PATCH',
      path: 'shipments/{{e2eShipmentId}}/status',
      auth: AUTH.courier,
      body: { status: 'DELIVERED' },
      test: okTest('Delivered - courier earning is created here', [200, 404, 409]),
    }),
    requestItem({
      name: '12. Verify Courier Earning',
      method: 'GET',
      path: 'couriers/me/earnings',
      auth: AUTH.courier,
      test: okTest('Earnings include this delivery', [200]),
    }),
  ],
  'Run this folder top-to-bottom (after Auth + Zones + Users have set their variables) to see the complete paid, courier-assigned, delivered lifecycle. Step 3 requires manually completing a real Stripe test-mode checkout in a browser.',
);

const collection = {
  info: {
    name: 'Courier & Logistics Platform API',
    description:
      'Full API surface for the Courier & Logistics Platform (Customer / Courier / Admin roles). Run folders top-to-bottom: Auth -> Zones -> Users -> Hubs -> Pricing -> Shipments -> Couriers -> Notifications -> Payments -> Admin -> End-to-End Demo. Import the matching environment file and set baseUrl if not running on localhost:5000.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:5000/api/v1' },
    { key: 'adminAccessToken', value: '' },
    { key: 'adminRefreshToken', value: '' },
    { key: 'adminId', value: '' },
    { key: 'customerAccessToken', value: '' },
    { key: 'customerRefreshToken', value: '' },
    { key: 'customerId', value: '' },
    { key: 'courierAccessToken', value: '' },
    { key: 'courierRefreshToken', value: '' },
    { key: 'courierId', value: '' },
    { key: 'registeredEmail', value: '' },
    { key: 'registeredUserId', value: '' },
    { key: 'originZoneId', value: '' },
    { key: 'destinationZoneId', value: '' },
    { key: 'demoZoneId', value: '' },
    { key: 'hubIdA', value: '' },
    { key: 'hubIdB', value: '' },
    { key: 'pickupAddressId', value: '' },
    { key: 'deliveryAddressId', value: '' },
    { key: 'shipmentId', value: '' },
    { key: 'trackingNumber', value: '' },
    { key: 'paymentId', value: '' },
    { key: 'checkoutUrl', value: '' },
    { key: 'notificationId', value: '' },
    { key: 'e2eShipmentId', value: '' },
    { key: 'e2eStripeSessionId', value: '' },
  ],
  item: [
    healthFolder,
    authFolder,
    zonesFolder,
    usersFolder,
    hubsFolder,
    pricingFolder,
    shipmentsFolder,
    couriersFolder,
    notificationsFolder,
    paymentsFolder,
    adminFolder,
    e2eFolder,
  ],
};

const environment = {
  id: 'courier-logistics-local',
  name: 'Courier & Logistics - Local',
  values: [{ key: 'baseUrl', value: 'http://localhost:5000/api/v1', enabled: true }],
  _postman_variable_scope: 'environment',
};

const outDir = join(__dirname, '..', 'postman');
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, 'courier-logistics.postman_collection.json'),
  JSON.stringify(collection, null, 2),
);
writeFileSync(
  join(outDir, 'courier-logistics.postman_environment.json'),
  JSON.stringify(environment, null, 2),
);

const totalRequests = collection.item.reduce(
  (sum, f) => sum + (f as { item: unknown[] }).item.length,
  0,
);
console.log(
  `Generated Postman collection with ${totalRequests} requests across ${collection.item.length} folders.`,
);
