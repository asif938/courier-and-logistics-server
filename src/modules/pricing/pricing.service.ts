import { prisma } from '../../config/prisma';
import type { ServiceType } from '../../generated/prisma/client';
import { ApiError } from '../../utils/ApiError';
import { withUniqueConstraintHandling } from '../../utils/prismaErrors';
import type { CreatePricingRuleInput } from './pricing.validation';

export interface PriceQuoteInput {
  originZoneId: string;
  destinationZoneId: string;
  serviceType: ServiceType;
  weightKg: number;
}

async function findApplicableRule(input: PriceQuoteInput) {
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

  return rule;
}

function computePrice(basePrice: number, perKgRate: number, weightKg: number): number {
  const price = basePrice + perKgRate * weightKg;
  return Math.round(price * 100) / 100;
}

export async function calculateShipmentPrice(input: PriceQuoteInput): Promise<number> {
  const rule = await findApplicableRule(input);
  return computePrice(Number(rule.basePrice), Number(rule.perKgRate), input.weightKg);
}

export async function getPriceQuote(input: PriceQuoteInput) {
  const rule = await findApplicableRule(input);
  const basePrice = Number(rule.basePrice);
  const perKgRate = Number(rule.perKgRate);
  return {
    price: computePrice(basePrice, perKgRate, input.weightKg),
    currency: 'USD',
    basePrice,
    perKgRate,
    weightKg: input.weightKg,
    serviceType: input.serviceType,
  };
}

export async function createPricingRule(data: CreatePricingRuleInput) {
  const [originZone, destinationZone] = await Promise.all([
    prisma.zone.findFirst({ where: { id: data.originZoneId, deletedAt: null } }),
    prisma.zone.findFirst({ where: { id: data.destinationZoneId, deletedAt: null } }),
  ]);

  if (!originZone) {
    throw ApiError.badRequest('Origin zone not found');
  }
  if (!destinationZone) {
    throw ApiError.badRequest('Destination zone not found');
  }

  return withUniqueConstraintHandling(
    () => prisma.pricingRule.create({ data }),
    'A pricing rule already exists for this route, service type, and weight tier',
  );
}
