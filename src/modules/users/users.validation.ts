import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
    phone: z.string().trim().min(7).max(20).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const createAddressSchema = z.object({
  label: z.string().trim().max(100).optional(),
  addressLine: z.string().trim().min(3, 'Address line is too short').max(200),
  city: z.string().trim().min(1, 'City is required').max(100),
  zoneId: z.string().cuid('Invalid zone id').optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  contactName: z.string().trim().min(1, 'Contact name is required').max(100),
  contactPhone: z.string().trim().min(7, 'Contact phone is too short').max(20),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
