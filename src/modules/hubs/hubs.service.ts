import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { recordAuditLog } from '../../utils/auditLog';
import { withUniqueConstraintHandling } from '../../utils/prismaErrors';
import type { CreateHubInput, ListHubsQuery, UpdateHubInput } from './hubs.validation';

export async function createHub(adminUserId: string, data: CreateHubInput, ipAddress?: string) {
  return prisma.$transaction(async (tx) => {
    const zone = await tx.zone.findFirst({ where: { id: data.zoneId, deletedAt: null } });
    if (!zone) {
      throw ApiError.badRequest('Zone not found');
    }

    const hub = await withUniqueConstraintHandling(
      () => tx.hub.create({ data }),
      'A hub with this code already exists',
    );

    await recordAuditLog(tx, {
      actorUserId: adminUserId,
      action: 'CREATE_HUB',
      entityType: 'Hub',
      entityId: hub.id,
      changes: { code: hub.code, name: hub.name, zoneId: hub.zoneId, capacity: hub.capacity },
      ipAddress,
    });

    return hub;
  });
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

export async function updateHub(
  adminUserId: string,
  hubId: string,
  data: UpdateHubInput,
  ipAddress?: string,
) {
  return prisma.$transaction(async (tx) => {
    const hub = await tx.hub.findFirst({ where: { id: hubId, deletedAt: null } });
    if (!hub) {
      throw ApiError.notFound('Hub not found');
    }

    const updated = await tx.hub.update({ where: { id: hubId }, data });

    await recordAuditLog(tx, {
      actorUserId: adminUserId,
      action: 'UPDATE_HUB',
      entityType: 'Hub',
      entityId: hubId,
      changes: {
        from: {
          name: hub.name,
          address: hub.address,
          capacity: hub.capacity,
          isActive: hub.isActive,
        },
        to: data,
      },
      ipAddress,
    });

    return updated;
  });
}

export async function softDeleteHub(adminUserId: string, hubId: string, ipAddress?: string) {
  await prisma.$transaction(async (tx) => {
    const hub = await tx.hub.findFirst({ where: { id: hubId, deletedAt: null } });
    if (!hub) {
      throw ApiError.notFound('Hub not found');
    }

    await tx.hub.update({
      where: { id: hubId },
      data: { deletedAt: new Date(), isActive: false },
    });

    await recordAuditLog(tx, {
      actorUserId: adminUserId,
      action: 'DELETE_HUB',
      entityType: 'Hub',
      entityId: hubId,
      changes: { code: hub.code, name: hub.name },
      ipAddress,
    });
  });
}
