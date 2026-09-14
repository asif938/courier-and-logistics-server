import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { buildPaginationMeta, toSkipTake } from '../../utils/pagination';
import type { EarningsQuery } from './couriers.validation';

export async function getMyEarnings(courierId: string, query: EarningsQuery) {
  const where = {
    courierId,
    ...(query.status && { status: query.status }),
  };

  const [earnings, total, summary] = await Promise.all([
    prisma.courierEarning.findMany({
      where,
      include: { shipment: { select: { trackingNumber: true } } },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(query),
    }),
    prisma.courierEarning.count({ where }),
    prisma.courierEarning.aggregate({ where: { courierId }, _sum: { amount: true } }),
  ]);

  return {
    earnings,
    meta: buildPaginationMeta(total, query),
    totalEarned: Number(summary._sum.amount ?? 0),
  };
}

export async function updateMyAvailability(courierId: string, isAvailable: boolean) {
  const profile = await prisma.courierProfile.findUnique({ where: { userId: courierId } });
  if (!profile) {
    throw ApiError.notFound('Courier profile not found');
  }

  return prisma.courierProfile.update({
    where: { userId: courierId },
    data: { isAvailable },
  });
}
