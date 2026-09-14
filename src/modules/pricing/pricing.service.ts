import { prisma } from '../../config/prisma';
import type { ServiceType } from '../../generated/prisma/client';
import { ApiError } from '../../utils/ApiError';

export interface PriceQuoteInput {
  originZoneId: string;
  destinationZoneId: string;
  serviceType: ServiceType;
  weightKg: number;
}

export async function calculateShipmentPrice(input: PriceQuoteInput): Promise<number> {
  const rule = await prisma.pricingRule.findFirst({
    where: {
      originZoneId: input.originZoneId,
      destinationZoneId: input.destinationZoneId,
      serviceType: input.serviceType,
      isActive: true,
      minWeightKg: { lte: input.weightKg },
      maxWeightKg: { gte: input.weightKg },
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  if (!rule) {
    throw ApiError.badRequest(
      'No pricing is available for this route, service type, and parcel weight',
    );
  }

  const price = Number(rule.basePrice) + Number(rule.perKgRate) * input.weightKg;
  return Math.round(price * 100) / 100;
}
