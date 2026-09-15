import { z } from 'zod';

export const initiatePaymentSchema = z.object({
  shipmentId: z.string().cuid('Invalid shipment id'),
});

export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED']).optional(),
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
