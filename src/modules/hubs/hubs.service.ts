import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import type { CreateHubInput, ListHubsQuery, UpdateHubInput } from './hubs.validation';

export async function createHub(data: CreateHubInput) {
  const [zone, existingCode] = await Promise.all([
    prisma.zone.findFirst({ where: { id: data.zoneId, deletedAt: null } }),
    prisma.hub.findUnique({ where: { code: data.code } }),
  ]);

  if (!zone) {
    throw ApiError.badRequest('Zone not found');
  }
  if (existingCode) {
    throw ApiError.conflict('A hub with this code already exists');
  }

  return prisma.hub.create({ data });
}

export function listHubs(query: ListHubsQuery) {
  return prisma.hub.findMany({
    where: {
      deletedAt: null,
      ...(query.zoneId && { zoneId: query.zoneId }),
    },
    include: { zone: true },
    orderBy: { name: 'asc' },
  });
}

export async function updateHub(hubId: string, data: UpdateHubInput) {
  const hub = await prisma.hub.findFirst({ where: { id: hubId, deletedAt: null } });
  if (!hub) {
    throw ApiError.notFound('Hub not found');
  }
  return prisma.hub.update({ where: { id: hubId }, data });
}

export async function softDeleteHub(hubId: string) {
  const hub = await prisma.hub.findFirst({ where: { id: hubId, deletedAt: null } });
  if (!hub) {
    throw ApiError.notFound('Hub not found');
  }
  await prisma.hub.update({
    where: { id: hubId },
    data: { deletedAt: new Date(), isActive: false },
  });
}
