import { prisma } from '../../config/prisma';
import { withUniqueConstraintHandling } from '../../utils/prismaErrors';
import type { CreateZoneInput } from './zones.validation';

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
