import { z } from 'zod';

export const updateAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

export const earningsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(['PENDING', 'PAID']).optional(),
});

export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
export type EarningsQuery = z.infer<typeof earningsQuerySchema>;
