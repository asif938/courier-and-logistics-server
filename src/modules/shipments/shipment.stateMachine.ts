import type { ShipmentStatus } from '../../generated/prisma/client';

export const MAX_DELIVERY_ATTEMPTS = 3;

export const ALLOWED_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  CREATED: [],
  PICKUP_SCHEDULED: [],
  COURIER_ASSIGNED: ['PICKED_UP'],
  PICKED_UP: ['AT_ORIGIN_HUB'],
  AT_ORIGIN_HUB: ['IN_TRANSIT'],
  IN_TRANSIT: ['AT_DESTINATION_HUB'],
  AT_DESTINATION_HUB: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED_DELIVERY_ATTEMPT'],
  FAILED_DELIVERY_ATTEMPT: ['OUT_FOR_DELIVERY', 'RETURN_TO_SENDER'],
  RETURN_TO_SENDER: ['RETURNED'],
  DELIVERED: [],
  RETURNED: [],
  CANCELLED: [],
};

export const CANCELLABLE_STATUSES: ShipmentStatus[] = [
  'CREATED',
  'PICKUP_SCHEDULED',
  'COURIER_ASSIGNED',
];

export const ACTIVE_COURIER_STATUSES: ShipmentStatus[] = [
  'COURIER_ASSIGNED',
  'PICKED_UP',
  'AT_ORIGIN_HUB',
  'IN_TRANSIT',
  'AT_DESTINATION_HUB',
  'OUT_FOR_DELIVERY',
  'FAILED_DELIVERY_ATTEMPT',
  'RETURN_TO_SENDER',
];

export const HUB_TRANSFER_ELIGIBLE_STATUSES: ShipmentStatus[] = [
  'PICKED_UP',
  'AT_ORIGIN_HUB',
  'IN_TRANSIT',
];

export function getAllowedTargets(
  status: ShipmentStatus,
  failedAttemptCount: number,
): ShipmentStatus[] {
  const targets = ALLOWED_TRANSITIONS[status] ?? [];
  if (status === 'FAILED_DELIVERY_ATTEMPT' && failedAttemptCount >= MAX_DELIVERY_ATTEMPTS) {
    return targets.filter((target) => target !== 'OUT_FOR_DELIVERY');
  }
  return targets;
}
