import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient, type ServiceType } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Demo credentials for evaluation - same password across every seeded account
// so all 3 roles (CUSTOMER, COURIER, ADMIN) can be exercised once auth lands.
const DEMO_PASSWORD = 'Passw0rd!123';

const SERVICE_TYPES: ServiceType[] = ['STANDARD', 'EXPRESS'];
const WEIGHT_TIERS = [
  { min: 0.1, max: 5 },
  { min: 5, max: 9999 },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // ---- Zones -------------------------------------------------------------
  const zoneSeeds = [
    { name: 'New York Metro', city: 'New York', region: 'NY' },
    { name: 'Los Angeles Metro', city: 'Los Angeles', region: 'CA' },
    { name: 'Chicago Metro', city: 'Chicago', region: 'IL' },
  ];
  const zones = await Promise.all(
    zoneSeeds.map((z) => prisma.zone.upsert({ where: { name: z.name }, update: {}, create: z })),
  );
  const [nyZone, laZone, chiZone] = zones;

  // ---- Hubs ----------------------------------------------------------------
  const hubSeeds = [
    {
      code: 'NYC-HUB-01',
      name: 'New York Sorting Hub',
      address: '123 Hub St, New York, NY',
      zoneId: nyZone.id,
    },
    {
      code: 'LAX-HUB-01',
      name: 'Los Angeles Sorting Hub',
      address: '456 Hub Ave, Los Angeles, CA',
      zoneId: laZone.id,
    },
    {
      code: 'CHI-HUB-01',
      name: 'Chicago Sorting Hub',
      address: '789 Hub Blvd, Chicago, IL',
      zoneId: chiZone.id,
    },
  ];
  const hubs = await Promise.all(
    hubSeeds.map((h) => prisma.hub.upsert({ where: { code: h.code }, update: {}, create: h })),
  );
  const [nyHub, laHub] = hubs;

  // ---- Pricing rules: base fare depends on same-zone vs cross-zone, ---------
  // service type, and weight tier. Generated rather than hand-listed since
  // it's a full cross-product (3 zones x 3 zones x 2 service types x 2 tiers).
  let pricingRuleCount = 0;
  for (const origin of zones) {
    for (const destination of zones) {
      for (const serviceType of SERVICE_TYPES) {
        for (const tier of WEIGHT_TIERS) {
          const isSameZone = origin.id === destination.id;
          const base = (isSameZone ? 3.99 : 8.99) * (serviceType === 'EXPRESS' ? 1.5 : 1);
          const perKg = (serviceType === 'EXPRESS' ? 1.25 : 0.75) + (tier.min >= 5 ? 0.25 : 0);

          await prisma.pricingRule.upsert({
            where: {
              originZoneId_destinationZoneId_serviceType_minWeightKg: {
                originZoneId: origin.id,
                destinationZoneId: destination.id,
                serviceType,
                minWeightKg: tier.min,
              },
            },
            update: {},
            create: {
              originZoneId: origin.id,
              destinationZoneId: destination.id,
              serviceType,
              minWeightKg: tier.min,
              maxWeightKg: tier.max,
              basePrice: base.toFixed(2),
              perKgRate: perKg.toFixed(2),
            },
          });
          pricingRuleCount += 1;
        }
      }
    }
  }

  // ---- Organization ----------------------------------------------------------
  const organization = await prisma.organization.upsert({
    where: { name: 'Acme Retail Co.' },
    update: {},
    create: { name: 'Acme Retail Co.' },
  });

  // ---- Users: 1 admin, 2 customers, 2 couriers -------------------------------
  await prisma.user.upsert({
    where: { email: 'admin@courierlogistics.dev' },
    update: {},
    create: {
      name: 'Platform Admin',
      email: 'admin@courierlogistics.dev',
      passwordHash,
      role: 'ADMIN',
    },
  });

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: { name: 'Alice Customer', email: 'alice@example.com', passwordHash, role: 'CUSTOMER' },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      name: 'Bob Customer',
      email: 'bob@example.com',
      passwordHash,
      role: 'CUSTOMER',
      organizationId: organization.id,
    },
  });

  const carl = await prisma.user.upsert({
    where: { email: 'carl@example.com' },
    update: {},
    create: { name: 'Carl Courier', email: 'carl@example.com', passwordHash, role: 'COURIER' },
  });

  const dana = await prisma.user.upsert({
    where: { email: 'dana@example.com' },
    update: {},
    create: { name: 'Dana Courier', email: 'dana@example.com', passwordHash, role: 'COURIER' },
  });

  await prisma.courierProfile.upsert({
    where: { userId: carl.id },
    update: {},
    create: {
      userId: carl.id,
      vehicleType: 'VAN',
      licenseNumber: 'NY-CDL-10021',
      zoneId: nyZone.id,
    },
  });

  await prisma.courierProfile.upsert({
    where: { userId: dana.id },
    update: {},
    create: {
      userId: dana.id,
      vehicleType: 'MOTORBIKE',
      licenseNumber: 'CA-DL-88213',
      zoneId: laZone.id,
    },
  });

  // ---- Addresses --------------------------------------------------------------
  async function findOrCreateAddress(
    userId: string,
    label: string,
    data: Parameters<typeof prisma.address.create>[0]['data'],
  ) {
    const existing = await prisma.address.findFirst({ where: { userId, label } });
    if (existing) return existing;
    return prisma.address.create({ data: { ...data, userId, label } });
  }

  const alicePickup = await findOrCreateAddress(alice.id, 'Alice Home', {
    addressLine: '10 Maple Street, Apt 4B',
    city: 'New York',
    zoneId: nyZone.id,
    contactName: 'Alice Customer',
    contactPhone: '+1-212-555-0101',
  });

  const aliceDelivery = await findOrCreateAddress(alice.id, 'Alice Recipient (Chicago)', {
    addressLine: '500 Lakeshore Dr, Unit 12',
    city: 'Chicago',
    zoneId: chiZone.id,
    contactName: 'Nora Recipient',
    contactPhone: '+1-312-555-0199',
  });

  const bobPickup = await findOrCreateAddress(bob.id, 'Bob Warehouse', {
    addressLine: '77 Industrial Way',
    city: 'New York',
    zoneId: nyZone.id,
    contactName: 'Bob Customer',
    contactPhone: '+1-212-555-0202',
  });

  const bobDelivery = await findOrCreateAddress(bob.id, 'Bob Recipient (LA)', {
    addressLine: '900 Sunset Blvd',
    city: 'Los Angeles',
    zoneId: laZone.id,
    contactName: 'Omar Recipient',
    contactPhone: '+1-310-555-0177',
  });

  // ---- Shipments: one freshly created, one fully delivered -------------------
  await prisma.shipment.upsert({
    where: { trackingNumber: 'CLP-DEMO-0001' },
    update: {},
    create: {
      trackingNumber: 'CLP-DEMO-0001',
      customerId: alice.id,
      pickupAddressId: alicePickup.id,
      deliveryAddressId: aliceDelivery.id,
      serviceType: 'STANDARD',
      status: 'CREATED',
      parcelWeightKg: '2.50',
      parcelDescription: 'Books',
      priceAmount: '10.24',
      statusHistory: {
        create: [
          { status: 'CREATED', note: 'Shipment created by customer', actorUserId: alice.id },
        ],
      },
    },
  });

  const deliveredShipment = await prisma.shipment.upsert({
    where: { trackingNumber: 'CLP-DEMO-0002' },
    update: {},
    create: {
      trackingNumber: 'CLP-DEMO-0002',
      customerId: bob.id,
      organizationId: organization.id,
      assignedCourierId: dana.id,
      pickupAddressId: bobPickup.id,
      deliveryAddressId: bobDelivery.id,
      originHubId: nyHub.id,
      destinationHubId: laHub.id,
      currentHubId: laHub.id,
      serviceType: 'EXPRESS',
      status: 'DELIVERED',
      parcelWeightKg: '6.00',
      parcelDescription: 'Electronics sample kit',
      priceAmount: '21.24',
    },
  });

  const existingHistory = await prisma.shipmentStatusHistory.count({
    where: { shipmentId: deliveredShipment.id },
  });
  if (existingHistory === 0) {
    const timeline: Array<{
      status: Parameters<typeof prisma.shipmentStatusHistory.create>[0]['data']['status'];
      note: string;
    }> = [
      { status: 'CREATED', note: 'Shipment created by customer' },
      { status: 'PICKUP_SCHEDULED', note: 'Pickup scheduled for next business day' },
      { status: 'COURIER_ASSIGNED', note: 'Courier assigned by dispatch' },
      { status: 'PICKED_UP', note: 'Courier collected the parcel' },
      { status: 'AT_ORIGIN_HUB', note: 'Arrived at origin sorting hub' },
      { status: 'IN_TRANSIT', note: 'In transit to destination hub' },
      { status: 'AT_DESTINATION_HUB', note: 'Arrived at destination sorting hub' },
      { status: 'OUT_FOR_DELIVERY', note: 'Out for final-mile delivery' },
      { status: 'DELIVERED', note: 'Delivered to recipient' },
    ];
    for (const [index, entry] of timeline.entries()) {
      await prisma.shipmentStatusHistory.create({
        data: {
          shipmentId: deliveredShipment.id,
          status: entry.status,
          note: entry.note,
          actorUserId: index === 0 ? bob.id : dana.id,
        },
      });
    }
  }

  const existingTransfer = await prisma.hubTransfer.findFirst({
    where: { shipmentId: deliveredShipment.id },
  });
  if (!existingTransfer) {
    await prisma.hubTransfer.create({
      data: {
        shipmentId: deliveredShipment.id,
        fromHubId: nyHub.id,
        toHubId: laHub.id,
        status: 'ARRIVED',
        arrivedAt: new Date(),
      },
    });
  }

  console.log('Seed complete:');
  console.log(`  Zones: ${zones.length}, Hubs: ${hubs.length}, Pricing rules: ${pricingRuleCount}`);
  console.log('  Demo accounts (all share the same password):');
  console.log(`    ADMIN    admin@courierlogistics.dev / ${DEMO_PASSWORD}`);
  console.log(`    CUSTOMER alice@example.com / ${DEMO_PASSWORD}`);
  console.log(`    CUSTOMER bob@example.com / ${DEMO_PASSWORD}`);
  console.log(`    COURIER  carl@example.com / ${DEMO_PASSWORD}`);
  console.log(`    COURIER  dana@example.com / ${DEMO_PASSWORD}`);
  console.log('  Sample shipments: CLP-DEMO-0001 (CREATED), CLP-DEMO-0002 (DELIVERED)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
