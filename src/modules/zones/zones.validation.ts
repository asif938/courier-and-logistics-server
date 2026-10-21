import { z } from 'zod';

export const createZoneSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  city: z.string().trim().min(1, 'City is required').max(100),
  region: z.string().trim().max(100).optional(),
});

export const updateZoneSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
    city: z.string().trim().min(1, 'City is required').max(100).optional(),
    region: z.string().trim().max(100).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreateZoneInput = z.infer<typeof createZoneSchema>;
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;
