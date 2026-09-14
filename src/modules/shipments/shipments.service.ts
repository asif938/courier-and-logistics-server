import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { buildPaginationMeta, toSkipTake } from '../../utils/pagination';
import { generateTrackingNumber } from '../../utils/trackingNumber';
import { calculateShipmentPrice } from '../pricing/pricing.service';
import type {
  CreateShipmentInput,
  ListShipmentsQuery,
  UpdateShipmentInput,
} from './shipments.validation';

interface AuthUser {
  id: string;
  role: 'CUSTOMER' | 'COURIER' | 'ADMIN';
}

const courierSelect = { id: true, name: true, phone: true } as const;

const shipmentInclude = {
  pickupAddress: true,
  deliveryAddress: true,
  assignedCourier: { select: courierSelect },
} as const;

const PRE_PICKUP_STATUSES = ['CREATED', 'PICKUP_SCHEDULED'] as const;

export async function createShipment(customerId: string, input: CreateShipmentInput) {
  const [pickup, delivery] = await Promise.all([
    prisma.address.findFirst({ where: { id: input.pickupAddressId, userId: customerId } }),
    prisma.address.findFirst({ where: { id: input.deliveryAddressId, userId: customerId } }),
  ]);

  if (!pickup) {
    throw ApiError.badRequest('Pickup address not found');
  }
  if (!delivery) {
    throw ApiError.badRequest('Delivery address not found');
  }
  if (!pickup.zoneId || !delivery.zoneId) {
    throw ApiError.badRequest(
      'Both pickup and delivery addresses must belong to a serviceable zone',
    );
  }

  const priceAmount = await calculateShipmentPrice({
    originZoneId: pickup.zoneId,
    destinationZoneId: delivery.zoneId,
    serviceType: input.serviceType,
    weightKg: input.parcelWeightKg,
  });

  return prisma.shipment.create({
    data: {
      trackingNumber: generateTrackingNumber(),
      customerId,
      pickupAddressId: pickup.id,
      deliveryAddressId: delivery.id,
      serviceType: input.serviceType,
      parcelWeightKg: input.parcelWeightKg,
      parcelDescription: input.parcelDescription,
      parcelValue: input.parcelValue,
      priceAmount,
      statusHistory: {
        create: [
          { status: 'CREATED', note: 'Shipment created by customer', actorUserId: customerId },
        ],
      },
    },
    include: shipmentInclude,
  });
}

export async function listShipments(user: AuthUser, query: ListShipmentsQuery) {
  const where = {
    deletedAt: null,
    ...(user.role === 'CUSTOMER' && { customerId: user.id }),
    ...(user.role === 'COURIER' && { assignedCourierId: user.id }),
    ...(query.status && { status: query.status }),
  };

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: shipmentInclude,
      orderBy: { [query.sortBy]: query.sortOrder },
      ...toSkipTake(query),
    }),
    prisma.shipment.count({ where }),
  ]);

  return { shipments, meta: buildPaginationMeta(total, query) };
}

async function findAccessibleShipment(user: AuthUser, shipmentId: string) {
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, deletedAt: null },
    include: shipmentInclude,
  });

  if (!shipment) {
    throw ApiError.notFound('Shipment not found');
  }

  const isOwner = user.role === 'CUSTOMER' && shipment.customerId === user.id;
  const isAssignedCourier = user.role === 'COURIER' && shipment.assignedCourierId === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isAssignedCourier && !isAdmin) {
    throw ApiError.notFound('Shipment not found');
  }

  return shipment;
}

export async function getShipmentById(user: AuthUser, shipmentId: string) {
  return findAccessibleShipment(user, shipmentId);
}

export async function updateShipment(
  user: AuthUser,
  shipmentId: string,
  data: UpdateShipmentInput,
) {
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, deletedAt: null, customerId: user.id },
  });

  if (!shipment) {
    throw ApiError.notFound('Shipment not found');
  }
  if (!PRE_PICKUP_STATUSES.includes(shipment.status as (typeof PRE_PICKUP_STATUSES)[number])) {
    throw ApiError.conflict('This shipment can no longer be edited');
  }

  if (data.deliveryAddressId) {
    const delivery = await prisma.address.findFirst({
      where: { id: data.deliveryAddressId, userId: user.id },
    });
    if (!delivery) {
      throw ApiError.badRequest('Delivery address not found');
    }
  }

  return prisma.shipment.update({
    where: { id: shipmentId },
    data,
    include: shipmentInclude,
  });
}

export async function softDeleteShipment(user: AuthUser, shipmentId: string) {
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, deletedAt: null },
  });

  if (!shipment) {
    throw ApiError.notFound('Shipment not found');
  }

  if (user.role === 'CUSTOMER') {
    if (shipment.customerId !== user.id) {
      throw ApiError.notFound('Shipment not found');
    }
    if (!PRE_PICKUP_STATUSES.includes(shipment.status as (typeof PRE_PICKUP_STATUSES)[number])) {
      throw ApiError.conflict('This shipment can no longer be cancelled');
    }
  }

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: { deletedAt: new Date() },
  });
}
