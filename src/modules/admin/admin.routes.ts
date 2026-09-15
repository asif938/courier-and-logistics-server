import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as adminController from './admin.controller';
import {
  listAuditLogsQuerySchema,
  listUsersQuerySchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from './admin.validation';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/users', validate(listUsersQuerySchema, 'query'), adminController.listUsers);
router.patch('/users/:id/role', validate(updateUserRoleSchema), adminController.updateUserRole);
router.patch(
  '/users/:id/status',
  validate(updateUserStatusSchema),
  adminController.updateUserStatus,
);
router.get('/dashboard-stats', adminController.getDashboardStats);
router.get(
  '/audit-logs',
  validate(listAuditLogsQuerySchema, 'query'),
  adminController.listAuditLogs,
);

export const adminRoutes = router;
