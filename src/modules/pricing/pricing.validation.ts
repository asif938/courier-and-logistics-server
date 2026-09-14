import { z } from 'zod';

export const quoteSchema = z.object({
  originZoneId: z.string().cuid('Invalid origin zone id'),
  destinationZoneId: z.string().cuid('Invalid destination zone id'),
  serviceType: z.enum(['STANDARD', 'EXPRESS']).default('STANDARD'),
  weightKg: z.number().positive('Weight must be greater than 0').max(1000),
});

export const createPricingRuleSchema = z
  .object({
    originZoneId: z.string().cuid('Invalid origin zone id'),
    destinationZoneId: z.string().cuid('Invalid destination zone id'),
    serviceType: z.enum(['STANDARD', 'EXPRESS']),
    minWeightKg: z.number().nonnegative(),
    maxWeightKg: z.number().positive(),
    basePrice: z.number().nonnegative(),
    perKgRate: z.number().nonnegative(),
  })
  .refine((data) => data.maxWeightKg > data.minWeightKg, {
    message: 'maxWeightKg must be greater than minWeightKg',
    path: ['maxWeightKg'],
  });

export type QuoteInput = z.infer<typeof quoteSchema>;
export type CreatePricingRuleInput = z.infer<typeof createPricingRuleSchema>;
