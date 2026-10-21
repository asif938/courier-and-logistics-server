import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { withUniqueConstraintHandling } from '../../utils/prismaErrors';
import type { CreateZoneInput, UpdateZoneInput } from './zones.validation';

export async function createZone(data: CreateZoneInput) {
  return withUniqueConstraintHandling(
    () => prisma.zone.create({ data }),
    'A zone with this name already exists',
  );
}

export function listZones() {
  return prisma.zone.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
  });
}

export async function updateZone(zoneId: string, data: UpdateZoneInput) {
  const zone = await prisma.zone.findFirst({ where: { id: zoneId, deletedAt: null } });
  if (!zone) {
    throw ApiError.notFound('Zone not found');
  }
  return withUniqueConstraintHandling(
    () => prisma.zone.update({ where: { id: zoneId }, data }),
    'A zone with this name already exists',
  );
}

export async function softDeleteZone(zoneId: string) {
  const zone = await prisma.zone.findFirst({ where: { id: zoneId, deletedAt: null } });
  if (!zone) {
    throw ApiError.notFound('Zone not found');
  }
  await prisma.zone.update({ where: { id: zoneId }, data: { deletedAt: new Date() } });
}
