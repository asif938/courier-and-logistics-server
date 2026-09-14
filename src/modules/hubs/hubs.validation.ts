import { z } from 'zod';

export const createHubSchema = z.object({
  code: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(150),
  address: z.string().trim().min(3).max(300),
  zoneId: z.string().cuid('Invalid zone id'),
  capacity: z.number().int().positive().default(1000),
});

export const updateHubSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    address: z.string().trim().min(3).max(300).optional(),
    capacity: z.number().int().positive().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const listHubsQuerySchema = z.object({
  zoneId: z.string().cuid('Invalid zone id').optional(),
});

export type CreateHubInput = z.infer<typeof createHubSchema>;
export type UpdateHubInput = z.infer<typeof updateHubSchema>;
export type ListHubsQuery = z.infer<typeof listHubsQuerySchema>;
