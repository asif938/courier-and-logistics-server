import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { recordAuditLog } from '../../utils/auditLog';
import { getOrSetCache } from '../../utils/cache';
import { buildPaginationMeta, toSkipTake } from '../../utils/pagination';
import { safeUserSelect } from '../../utils/safeUserSelect';
import type { ListAuditLogsQuery, ListUsersQuery } from './admin.validation';

const DASHBOARD_STATS_CACHE_KEY = 'admin:dashboard-stats';
const DASHBOARD_STATS_CACHE_TTL_SECONDS = 30;

export async function listUsers(query: ListUsersQuery) {
  const where = {
    deletedAt: null,
    ...(query.role && { role: query.role }),
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.q && {
      OR: [
        { name: { contains: query.q, mode: 'insensitive' as const } },
        { email: { contains: query.q, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: safeUserSelect,
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(query),
    }),
    prisma.user.count({ where }),
  ]);

  return { users, meta: buildPaginationMeta(total, query) };
}

export async function updateUserRole(
  adminUserId: string,
  targetUserId: string,
  role: 'CUSTOMER' | 'COURIER' | 'ADMIN',
  ipAddress?: string,
) {
  if (targetUserId === adminUserId) {
    throw ApiError.badRequest('You cannot change your own role');
  }

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({ where: { id: targetUserId, deletedAt: null } });
    if (!target) {
      throw ApiError.notFound('User not found');
    }

    const updated = await tx.user.update({
      where: { id: targetUserId },
      data: { role },
      select: safeUserSelect,
    });

    await recordAuditLog(tx, {
      actorUserId: adminUserId,
      action: 'UPDATE_USER_ROLE',
      entityType: 'User',
      entityId: targetUserId,
      changes: { from: target.role, to: role },
      ipAddress,
    });

    return updated;
  });
}

export async function updateUserStatus(
  adminUserId: string,
  targetUserId: string,
  isActive: boolean,
  ipAddress?: string,
) {
  if (targetUserId === adminUserId) {
    throw ApiError.badRequest('You cannot change your own account status');
  }

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({ where: { id: targetUserId, deletedAt: null } });
    if (!target) {
      throw ApiError.notFound('User not found');
    }

    const updated = await tx.user.update({
      where: { id: targetUserId },
      data: { isActive },
      select: safeUserSelect,
    });

    if (target.role === 'COURIER' && !isActive) {
      await tx.courierProfile.updateMany({
        where: { userId: targetUserId },
        data: { isAvailable: false },
      });
    }

    await recordAuditLog(tx, {
      actorUserId: adminUserId,
      action: 'UPDATE_USER_STATUS',
      entityType: 'User',
      entityId: targetUserId,
      changes: { from: target.isActive, to: isActive },
      ipAddress,
    });

    return updated;
  });
}

export async function getDashboardStats() {
  return getOrSetCache(DASHBOARD_STATS_CACHE_KEY, DASHBOARD_STATS_CACHE_TTL_SECONDS, () =>
    computeDashboardStats(),
  );
}

async function computeDashboardStats() {
  const [statusCounts, revenueAgg, courierAvailability, totalUsers, totalShipments] =
    await Promise.all([
      prisma.shipment.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: { deletedAt: null },
      }),
      prisma.payment.aggregate({ where: { status: 'SUCCEEDED' }, _sum: { amount: true } }),
      prisma.courierProfile.groupBy({ by: ['isAvailable'], _count: { _all: true } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.shipment.count({ where: { deletedAt: null } }),
    ]);

  const shipmentsByStatus = Object.fromEntries(
    statusCounts.map((row) => [row.status, row._count._all]),
  );
  const delivered = shipmentsByStatus.DELIVERED ?? 0;
  const returned = shipmentsByStatus.RETURNED ?? 0;
  const deliveryOutcomes = delivered + returned;

  const totalCouriers = courierAvailability.reduce((sum, row) => sum + row._count._all, 0);
  const busyCouriers =
    courierAvailability.find((row) => row.isAvailable === false)?._count._all ?? 0;

  return {
    totalUsers,
    totalShipments,
    shipmentsByStatus,
    revenue: Number(revenueAgg._sum.amount ?? 0),
    deliverySuccessRatePercent:
      deliveryOutcomes > 0 ? Math.round((delivered / deliveryOutcomes) * 1000) / 10 : null,
    courierUtilization: {
      total: totalCouriers,
      busy: busyCouriers,
      available: totalCouriers - busyCouriers,
      utilizationPercent:
        totalCouriers > 0 ? Math.round((busyCouriers / totalCouriers) * 1000) / 10 : 0,
    },
  };
}

export async function listAuditLogs(query: ListAuditLogsQuery) {
  const where = {
    ...(query.action && { action: query.action }),
    ...(query.entityType && { entityType: query.entityType }),
    ...(query.actorUserId && { actorUserId: query.actorUserId }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(query),
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, meta: buildPaginationMeta(total, query) };
}
