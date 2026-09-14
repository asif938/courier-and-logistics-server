import { z } from 'zod';

export const createZoneSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  city: z.string().trim().min(1, 'City is required').max(100),
  region: z.string().trim().max(100).optional(),
});

export type CreateZoneInput = z.infer<typeof createZoneSchema>;
