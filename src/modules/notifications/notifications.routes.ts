import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as notificationsController from './notifications.controller';
import { listNotificationsQuerySchema } from './notifications.validation';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validate(listNotificationsQuerySchema, 'query'),
  notificationsController.listMyNotifications,
);
router.patch('/:id/read', notificationsController.markAsRead);

export const notificationRoutes = router;
