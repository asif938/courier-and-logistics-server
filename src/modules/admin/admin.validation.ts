import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  role: z.enum(['CUSTOMER', 'COURIER', 'ADMIN']).optional(),
  isActive: z.coerce.boolean().optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['CUSTOMER', 'COURIER', 'ADMIN']),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  action: z.string().trim().min(1).max(100).optional(),
  entityType: z.string().trim().min(1).max(100).optional(),
  actorUserId: z.string().cuid('Invalid actor user id').optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
