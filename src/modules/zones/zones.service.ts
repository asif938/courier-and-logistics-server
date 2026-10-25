import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { recordAuditLog } from '../../utils/auditLog';
import { withUniqueConstraintHandling } from '../../utils/prismaErrors';
import type { CreateZoneInput, UpdateZoneInput } from './zones.validation';

export async function createZone(adminUserId: string, data: CreateZoneInput, ipAddress?: string) {
  return prisma.$transaction(async (tx) => {
    const zone = await withUniqueConstraintHandling(
      () => tx.zone.create({ data }),
      'A zone with this name already exists',
    );

    await recordAuditLog(tx, {
      actorUserId: adminUserId,
      action: 'CREATE_ZONE',
      entityType: 'Zone',
      entityId: zone.id,
      changes: { name: zone.name, city: zone.city, region: zone.region },
      ipAddress,
    });

    return zone;
  });
}

export function listZones() {
  return prisma.zone.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
  });
}

export async function updateZone(
  adminUserId: string,
  zoneId: string,
  data: UpdateZoneInput,
  ipAddress?: string,
) {
  return prisma.$transaction(async (tx) => {
    const zone = await tx.zone.findFirst({ where: { id: zoneId, deletedAt: null } });
    if (!zone) {
      throw ApiError.notFound('Zone not found');
    }

    const updated = await withUniqueConstraintHandling(
      () => tx.zone.update({ where: { id: zoneId }, data }),
      'A zone with this name already exists',
    );

    await recordAuditLog(tx, {
      actorUserId: adminUserId,
      action: 'UPDATE_ZONE',
      entityType: 'Zone',
      entityId: zoneId,
      changes: {
        from: { name: zone.name, city: zone.city, region: zone.region },
        to: data,
      },
      ipAddress,
    });

    return updated;
  });
}

export async function softDeleteZone(adminUserId: string, zoneId: string, ipAddress?: string) {
  await prisma.$transaction(async (tx) => {
    const zone = await tx.zone.findFirst({ where: { id: zoneId, deletedAt: null } });
    if (!zone) {
      throw ApiError.notFound('Zone not found');
    }

    await tx.zone.update({ where: { id: zoneId }, data: { deletedAt: new Date() } });

    await recordAuditLog(tx, {
      actorUserId: adminUserId,
      action: 'DELETE_ZONE',
      entityType: 'Zone',
      entityId: zoneId,
      changes: { name: zone.name, city: zone.city, region: zone.region },
      ipAddress,
    });
  });
}
