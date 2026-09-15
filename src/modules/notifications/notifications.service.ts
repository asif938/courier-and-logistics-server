import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { buildPaginationMeta, toSkipTake } from '../../utils/pagination';
import type { ListNotificationsQuery } from './notifications.validation';

export async function listMyNotifications(userId: string, query: ListNotificationsQuery) {
  const where = {
    userId,
    ...(query.isRead !== undefined && { isRead: query.isRead }),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(query),
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { notifications, meta: buildPaginationMeta(total, query), unreadCount };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });
  if (!notification) {
    throw ApiError.notFound('Notification not found');
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}
