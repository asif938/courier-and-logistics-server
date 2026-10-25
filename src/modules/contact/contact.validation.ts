import { z } from 'zod';

export const updateContactSettingsSchema = z
  .object({
    email: z.string().trim().email('Invalid email address').max(150).optional(),
    phone: z.string().trim().min(3, 'Phone must be at least 3 characters').max(40).optional(),
    location: z
      .string()
      .trim()
      .min(2, 'Location must be at least 2 characters')
      .max(200)
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const contactMessageSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Invalid email address').max(150),
  subject: z.string().trim().min(1, 'Subject is required').max(150),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000),
});

export type UpdateContactSettingsInput = z.infer<typeof updateContactSettingsSchema>;
export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
