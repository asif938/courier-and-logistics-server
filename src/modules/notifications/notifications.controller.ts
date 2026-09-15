import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/express';
import { sendSuccess } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';
import * as notificationsService from './notifications.service';
import type { ListNotificationsQuery } from './notifications.validation';

export const listMyNotifications = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const query = req.validatedQuery as unknown as ListNotificationsQuery;
  const { notifications, meta, unreadCount } = await notificationsService.listMyNotifications(
    req.user.id,
    query,
  );
  return sendSuccess(res, { data: { notifications, meta, unreadCount } });
});

export const markAsRead = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const notification = await notificationsService.markNotificationRead(
    req.user.id,
    req.params.id as string,
  );
  return sendSuccess(res, { message: 'Notification marked as read', data: { notification } });
});
