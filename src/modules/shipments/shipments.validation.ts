import { z } from 'zod';

export const SHIPMENT_STATUSES = [
  'CREATED',
  'PICKUP_SCHEDULED',
  'COURIER_ASSIGNED',
  'PICKED_UP',
  'AT_ORIGIN_HUB',
  'IN_TRANSIT',
  'AT_DESTINATION_HUB',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED_DELIVERY_ATTEMPT',
  'RETURN_TO_SENDER',
  'RETURNED',
  'CANCELLED',
] as const;

export const createShipmentSchema = z
  .object({
    pickupAddressId: z.string().cuid('Invalid pickup address id'),
    deliveryAddressId: z.string().cuid('Invalid delivery address id'),
    serviceType: z.enum(['STANDARD', 'EXPRESS']).default('STANDARD'),
    parcelWeightKg: z.number().positive('Weight must be greater than 0').max(1000),
    parcelDescription: z.string().trim().max(300).optional(),
    parcelValue: z.number().nonnegative().optional(),
  })
  .refine((data) => data.pickupAddressId !== data.deliveryAddressId, {
    message: 'Pickup and delivery address must be different',
    path: ['deliveryAddressId'],
  });

export const updateShipmentSchema = z
  .object({
    deliveryAddressId: z.string().cuid('Invalid delivery address id').optional(),
    parcelDescription: z.string().trim().max(300).optional(),
    parcelValue: z.number().nonnegative().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const listShipmentsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(SHIPMENT_STATUSES).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priceAmount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const searchShipmentsQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1, 'Search query is required').max(100),
});

export const assignCourierSchema = z.object({
  courierId: z.string().cuid('Invalid courier id').optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(SHIPMENT_STATUSES),
  note: z.string().trim().max(500).optional(),
  location: z.string().trim().max(200).optional(),
});

export const hubTransferSchema = z
  .object({
    fromHubId: z.string().cuid('Invalid origin hub id'),
    toHubId: z.string().cuid('Invalid destination hub id'),
  })
  .refine((data) => data.fromHubId !== data.toHubId, {
    message: 'fromHubId and toHubId must be different',
    path: ['toHubId'],
  });

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;
export type ListShipmentsQuery = z.infer<typeof listShipmentsQuerySchema>;
export type SearchShipmentsQuery = z.infer<typeof searchShipmentsQuerySchema>;
export type AssignCourierInput = z.infer<typeof assignCourierSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type HubTransferInput = z.infer<typeof hubTransferSchema>;
