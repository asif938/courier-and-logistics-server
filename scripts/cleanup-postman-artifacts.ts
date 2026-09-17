import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SEEDED_EMAILS = [
  'admin@courierlogistics.dev',
  'alice@example.com',
  'bob@example.com',
  'carl@example.com',
  'dana@example.com',
];

const THROWAWAY_NAMES = ['Postman Demo User', 'Duplicate Attempt'];
const ADDRESS_LABELS = ['Postman Pickup', 'Postman Delivery'];

async function main() {
  const throwawayUsers = await prisma.user.findMany({
    where: { name: { in: THROWAWAY_NAMES } },
    select: { id: true },
  });
  const throwawayUserIds = throwawayUsers.map((u) => u.id);

  const markedAddresses = await prisma.address.findMany({
    where: { label: { in: ADDRESS_LABELS } },
    select: { id: true },
  });
  const markedAddressIds = markedAddresses.map((a) => a.id);

  const markedShipments = await prisma.shipment.findMany({
    where: {
      OR: [
        { pickupAddressId: { in: markedAddressIds } },
        { deliveryAddressId: { in: markedAddressIds } },
        { customerId: { in: throwawayUserIds } },
      ],
    },
    select: { id: true },
  });
  const shipmentIds = markedShipments.map((s) => s.id);

  await prisma.notification.deleteMany({ where: { userId: { in: throwawayUserIds } } });
  await prisma.courierEarning.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
  await prisma.hubTransfer.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
  await prisma.payment.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
  await prisma.shipmentStatusHistory.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
  await prisma.shipment.deleteMany({ where: { id: { in: shipmentIds } } });

  await prisma.address.deleteMany({
    where: {
      OR: [{ id: { in: markedAddressIds } }, { userId: { in: throwawayUserIds } }],
    },
  });

  await prisma.courierProfile.deleteMany({ where: { userId: { in: throwawayUserIds } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: throwawayUserIds } } });
  await prisma.auditLog.deleteMany({ where: { actorUserId: { in: throwawayUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: throwawayUserIds } } });

  await prisma.pricingRule.deleteMany({
    where: { originZone: { name: { startsWith: 'Postman Demo Zone' } } },
  });
  await prisma.hub.deleteMany({ where: { name: { startsWith: 'Postman Demo Hub' } } });
  await prisma.zone.deleteMany({ where: { name: { startsWith: 'Postman Demo Zone' } } });

  await prisma.courierProfile.updateMany({
    where: { user: { email: { in: ['carl@example.com', 'dana@example.com'] } } },
    data: { isAvailable: true, totalDeliveries: 0 },
  });

  await prisma.refreshToken.deleteMany({
    where: { user: { email: { in: SEEDED_EMAILS } } },
  });

  console.log('Postman artifact cleanup complete:', {
    throwawayUsers: throwawayUserIds.length,
    shipments: shipmentIds.length,
    addresses: markedAddressIds.length,
  });
}

main().finally(() => prisma.$disconnect());
