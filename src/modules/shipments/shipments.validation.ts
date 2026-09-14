import { z } from 'zod';

const SHIPMENT_STATUSES = [
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

export const listShipmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(SHIPMENT_STATUSES).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priceAmount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;
export type ListShipmentsQuery = z.infer<typeof listShipmentsQuerySchema>;
