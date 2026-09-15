import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  isRead: z.coerce.boolean().optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
