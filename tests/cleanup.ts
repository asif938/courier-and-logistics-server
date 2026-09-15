import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const testPrisma = new PrismaClient({ adapter });

export async function cleanupTestData() {
  const users = await testPrisma.user.findMany({
    where: { email: { endsWith: '@test-suite.local' } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  const shipments = await testPrisma.shipment.findMany({
    where: { customerId: { in: userIds } },
    select: { id: true },
  });
  const shipmentIds = shipments.map((s) => s.id);

  await testPrisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await testPrisma.courierEarning.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
  await testPrisma.hubTransfer.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
  await testPrisma.payment.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
  await testPrisma.shipmentStatusHistory.deleteMany({
    where: { shipmentId: { in: shipmentIds } },
  });
  await testPrisma.shipment.deleteMany({ where: { id: { in: shipmentIds } } });
  await testPrisma.address.deleteMany({ where: { userId: { in: userIds } } });
  await testPrisma.courierProfile.deleteMany({ where: { userId: { in: userIds } } });
  await testPrisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  await testPrisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
  await testPrisma.user.deleteMany({ where: { id: { in: userIds } } });

  await testPrisma.pricingRule.deleteMany({
    where: { originZone: { name: { startsWith: 'Test Suite Zone' } } },
  });
  await testPrisma.hub.deleteMany({ where: { name: { startsWith: 'Test Suite Hub' } } });
  await testPrisma.zone.deleteMany({ where: { name: { startsWith: 'Test Suite Zone' } } });

  const SEEDED_EMAILS = [
    'admin@courierlogistics.dev',
    'alice@example.com',
    'bob@example.com',
    'carl@example.com',
    'dana@example.com',
  ];

  await testPrisma.courierProfile.updateMany({
    where: { user: { email: { in: ['carl@example.com', 'dana@example.com'] } } },
    data: { isAvailable: true, totalDeliveries: 0 },
  });

  await testPrisma.refreshToken.deleteMany({
    where: { user: { email: { in: SEEDED_EMAILS } } },
  });
}
