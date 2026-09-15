import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/express';
import { sendSuccess } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';
import * as adminService from './admin.service';
import type {
  ListAuditLogsQuery,
  ListUsersQuery,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
} from './admin.validation';

export const listUsers = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const query = req.validatedQuery as unknown as ListUsersQuery;
  const { users, meta } = await adminService.listUsers(query);
  return sendSuccess(res, { data: { users, meta } });
});

export const updateUserRole = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { role } = req.body as UpdateUserRoleInput;
  const user = await adminService.updateUserRole(
    req.user.id,
    req.params.id as string,
    role,
    req.ip,
  );
  return sendSuccess(res, { message: 'User role updated successfully', data: { user } });
});

export const updateUserStatus = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { isActive } = req.body as UpdateUserStatusInput;
  const user = await adminService.updateUserStatus(
    req.user.id,
    req.params.id as string,
    isActive,
    req.ip,
  );
  return sendSuccess(res, { message: 'User status updated successfully', data: { user } });
});

export const getDashboardStats = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const stats = await adminService.getDashboardStats();
  return sendSuccess(res, { data: stats });
});

export const listAuditLogs = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const query = req.validatedQuery as unknown as ListAuditLogsQuery;
  const { logs, meta } = await adminService.listAuditLogs(query);
  return sendSuccess(res, { data: { logs, meta } });
});
