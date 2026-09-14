import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import type { CreateZoneInput } from './zones.validation';

export async function createZone(data: CreateZoneInput) {
  const existing = await prisma.zone.findUnique({ where: { name: data.name } });
  if (existing) {
    throw ApiError.conflict('A zone with this name already exists');
  }
  return prisma.zone.create({ data });
}

export function listZones() {
  return prisma.zone.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
  });
}
