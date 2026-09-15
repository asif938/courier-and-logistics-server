import { prisma } from '../../config/prisma';
import type { ShipmentStatus } from '../../generated/prisma/client';
import { ApiError } from '../../utils/ApiError';
import { buildPaginationMeta, toSkipTake } from '../../utils/pagination';
import { generateTrackingNumber } from '../../utils/trackingNumber';
import { calculateShipmentPrice } from '../pricing/pricing.service';
import {
  ACTIVE_COURIER_STATUSES,
  CANCELLABLE_STATUSES,
  getAllowedTargets,
  HUB_TRANSFER_ELIGIBLE_STATUSES,
} from './shipment.stateMachine';
import type {
  CreateShipmentInput,
  ListShipmentsQuery,
  PaginationQuery,
  SearchShipmentsQuery,
  UpdateShipmentInput,
} from './shipments.validation';

interface AuthUser {
  id: string;
  role: 'CUSTOMER' | 'COURIER' | 'ADMIN';
}

const COURIER_EARNING_RATE = 0.8;

const courierSelect = { id: true, name: true, phone: true } as const;

const shipmentInclude = {
  pickupAddress: true,
  deliveryAddress: true,
  assignedCourier: { select: courierSelect },
} as const;

const PRE_PICKUP_STATUSES = ['CREATED', 'PICKUP_SCHEDULED'] as const;

export async function createShipment(customerId: string, input: CreateShipmentInput) {
  const [pickup, delivery, customer] = await Promise.all([
    prisma.address.findFirst({ where: { id: input.pickupAddressId, userId: customerId } }),
    prisma.address.findFirst({ where: { id: input.deliveryAddressId, userId: customerId } }),
    prisma.user.findUnique({ where: { id: customerId }, select: { organizationId: true } }),
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
      organizationId: customer?.organizationId,
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

export async function searchShipments(user: AuthUser, query: SearchShipmentsQuery) {
  const scope = {
    ...(user.role === 'CUSTOMER' && { customerId: user.id }),
    ...(user.role === 'COURIER' && { assignedCourierId: user.id }),
  };

  const where = {
    deletedAt: null,
    ...scope,
    OR: [
      { trackingNumber: { contains: query.q, mode: 'insensitive' as const } },
      { deliveryAddress: { contactName: { contains: query.q, mode: 'insensitive' as const } } },
      { deliveryAddress: { city: { contains: query.q, mode: 'insensitive' as const } } },
    ],
  };

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: shipmentInclude,
      orderBy: { createdAt: 'desc' },
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

export async function getShipmentTracking(user: AuthUser, shipmentId: string) {
  const shipment = await findAccessibleShipment(user, shipmentId);
  const history = await prisma.shipmentStatusHistory.findMany({
    where: { shipmentId: shipment.id },
    orderBy: { createdAt: 'asc' },
    include: { actor: { select: { id: true, name: true, role: true } } },
  });

  return {
    trackingNumber: shipment.trackingNumber,
    status: shipment.status,
    history,
  };
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

export async function requestPickup(user: AuthUser, shipmentId: string) {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findFirst({
      where: { id: shipmentId, deletedAt: null, customerId: user.id },
    });
    if (!shipment) {
      throw ApiError.notFound('Shipment not found');
    }
    if (shipment.status !== 'CREATED') {
      throw ApiError.conflict('Pickup can only be requested for a newly created shipment');
    }

    const payment = await tx.payment.findFirst({
      where: { shipmentId, status: 'SUCCEEDED' },
    });
    if (!payment) {
      throw ApiError.conflict('This shipment must be paid for before pickup can be scheduled');
    }

    return tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: 'PICKUP_SCHEDULED',
        statusHistory: {
          create: [
            {
              status: 'PICKUP_SCHEDULED',
              note: 'Pickup requested by customer',
              actorUserId: user.id,
            },
          ],
        },
      },
      include: shipmentInclude,
    });
  });
}

export async function assignCourier(adminUserId: string, shipmentId: string, courierId?: string) {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findFirst({
      where: { id: shipmentId, deletedAt: null },
      include: { pickupAddress: true },
    });
    if (!shipment) {
      throw ApiError.notFound('Shipment not found');
    }
    if (shipment.status !== 'PICKUP_SCHEDULED') {
      throw ApiError.conflict('A courier can only be assigned once pickup has been scheduled');
    }

    let targetCourierId = courierId;
    if (targetCourierId) {
      const courier = await tx.user.findFirst({
        where: { id: targetCourierId, role: 'COURIER', isActive: true, deletedAt: null },
        include: { courierProfile: true },
      });
      if (!courier?.courierProfile) {
        throw ApiError.badRequest('Courier not found');
      }
      if (!courier.courierProfile.isAvailable) {
        throw ApiError.conflict('Courier is not available');
      }
    } else {
      if (!shipment.pickupAddress.zoneId) {
        throw ApiError.badRequest(
          'Pickup address has no serviceable zone to match a courier against',
        );
      }
      const candidate = await tx.courierProfile.findFirst({
        where: {
          zoneId: shipment.pickupAddress.zoneId,
          isAvailable: true,
          user: { isActive: true, deletedAt: null },
        },
        orderBy: { totalDeliveries: 'asc' },
      });
      if (!candidate) {
        throw ApiError.conflict('No available courier found in the pickup zone');
      }
      targetCourierId = candidate.userId;
    }

    const claim = await tx.courierProfile.updateMany({
      where: { userId: targetCourierId, isAvailable: true },
      data: { isAvailable: false },
    });
    if (claim.count === 0) {
      throw ApiError.conflict('Selected courier is no longer available');
    }

    const updated = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        assignedCourierId: targetCourierId,
        status: 'COURIER_ASSIGNED',
        statusHistory: {
          create: [
            {
              status: 'COURIER_ASSIGNED',
              note: 'Courier assigned by dispatch',
              actorUserId: adminUserId,
            },
          ],
        },
      },
      include: shipmentInclude,
    });

    await tx.notification.createMany({
      data: [
        {
          userId: shipment.customerId,
          type: 'SHIPMENT_UPDATE',
          title: 'Courier assigned',
          message: `A courier has been assigned to shipment ${updated.trackingNumber}`,
        },
        {
          userId: targetCourierId,
          type: 'ASSIGNMENT',
          title: 'New delivery assigned',
          message: `You have been assigned shipment ${updated.trackingNumber}`,
        },
      ],
    });

    return updated;
  });
}

export async function updateShipmentStatus(
  user: AuthUser,
  shipmentId: string,
  targetStatus: ShipmentStatus,
  note?: string,
  location?: string,
) {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findFirst({ where: { id: shipmentId, deletedAt: null } });
    if (!shipment) {
      throw ApiError.notFound('Shipment not found');
    }
    if (user.role === 'COURIER' && shipment.assignedCourierId !== user.id) {
      throw ApiError.notFound('Shipment not found');
    }

    const allowedTargets = getAllowedTargets(shipment.status, shipment.failedAttemptCount);
    if (!allowedTargets.includes(targetStatus)) {
      throw ApiError.conflict(`Cannot transition from ${shipment.status} to ${targetStatus}`);
    }

    if (
      (targetStatus === 'FAILED_DELIVERY_ATTEMPT' || targetStatus === 'RETURN_TO_SENDER') &&
      !note?.trim()
    ) {
      throw ApiError.badRequest(`A note explaining the reason is required for ${targetStatus}`);
    }

    if (targetStatus === 'DELIVERED' && shipment.assignedCourierId) {
      await tx.courierProfile.updateMany({
        where: { userId: shipment.assignedCourierId },
        data: { isAvailable: true, totalDeliveries: { increment: 1 } },
      });
      await tx.courierEarning.create({
        data: {
          courierId: shipment.assignedCourierId,
          shipmentId: shipment.id,
          amount: Math.round(Number(shipment.priceAmount) * COURIER_EARNING_RATE * 100) / 100,
        },
      });
    } else if (targetStatus === 'RETURNED' && shipment.assignedCourierId) {
      await tx.courierProfile.updateMany({
        where: { userId: shipment.assignedCourierId },
        data: { isAvailable: true },
      });
    }

    const updated = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: targetStatus,
        ...(targetStatus === 'FAILED_DELIVERY_ATTEMPT' && {
          failedAttemptCount: { increment: 1 },
        }),
        ...(targetStatus === 'RETURN_TO_SENDER' && { returnReason: note }),
        statusHistory: {
          create: [
            {
              status: targetStatus,
              note: note ?? `Status updated to ${targetStatus}`,
              location,
              actorUserId: user.id,
            },
          ],
        },
      },
      include: shipmentInclude,
    });

    await tx.notification.create({
      data: {
        userId: shipment.customerId,
        type: 'SHIPMENT_UPDATE',
        title: 'Shipment status updated',
        message: `Shipment ${updated.trackingNumber} is now ${targetStatus.replaceAll('_', ' ').toLowerCase()}`,
      },
    });

    return updated;
  });
}

export async function cancelShipment(user: AuthUser, shipmentId: string) {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findFirst({ where: { id: shipmentId, deletedAt: null } });
    if (!shipment) {
      throw ApiError.notFound('Shipment not found');
    }
    if (user.role === 'CUSTOMER' && shipment.customerId !== user.id) {
      throw ApiError.notFound('Shipment not found');
    }
    if (!CANCELLABLE_STATUSES.includes(shipment.status)) {
      throw ApiError.conflict('This shipment can no longer be cancelled');
    }

    if (shipment.assignedCourierId) {
      await tx.courierProfile.updateMany({
        where: { userId: shipment.assignedCourierId },
        data: { isAvailable: true },
      });
    }

    const updated = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: 'CANCELLED',
        statusHistory: {
          create: [
            {
              status: 'CANCELLED',
              note: `Shipment cancelled by ${user.role.toLowerCase()}`,
              actorUserId: user.id,
            },
          ],
        },
      },
      include: shipmentInclude,
    });

    const notifyUserIds = [
      ...(user.role === 'ADMIN' ? [shipment.customerId] : []),
      ...(shipment.assignedCourierId ? [shipment.assignedCourierId] : []),
    ];
    if (notifyUserIds.length > 0) {
      await tx.notification.createMany({
        data: notifyUserIds.map((userId) => ({
          userId,
          type: 'SHIPMENT_UPDATE' as const,
          title: 'Shipment cancelled',
          message: `Shipment ${updated.trackingNumber} has been cancelled`,
        })),
      });
    }

    return updated;
  });
}

export async function listMyAssignedShipments(courierId: string, query: PaginationQuery) {
  const where = {
    assignedCourierId: courierId,
    deletedAt: null,
    status: { in: ACTIVE_COURIER_STATUSES },
  };

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: shipmentInclude,
      orderBy: { updatedAt: 'desc' },
      ...toSkipTake(query),
    }),
    prisma.shipment.count({ where }),
  ]);

  return { shipments, meta: buildPaginationMeta(total, query) };
}

export async function recordHubTransfer(
  adminUserId: string,
  shipmentId: string,
  fromHubId: string,
  toHubId: string,
) {
  return prisma.$transaction(async (tx) => {
    const [shipment, fromHub, toHub] = await Promise.all([
      tx.shipment.findFirst({ where: { id: shipmentId, deletedAt: null } }),
      tx.hub.findFirst({ where: { id: fromHubId, deletedAt: null } }),
      tx.hub.findFirst({ where: { id: toHubId, deletedAt: null } }),
    ]);

    if (!shipment) {
      throw ApiError.notFound('Shipment not found');
    }
    if (!fromHub) {
      throw ApiError.badRequest('Origin hub not found');
    }
    if (!toHub) {
      throw ApiError.badRequest('Destination hub not found');
    }
    if (!HUB_TRANSFER_ELIGIBLE_STATUSES.includes(shipment.status)) {
      throw ApiError.conflict(
        `A hub transfer cannot be recorded while the shipment is ${shipment.status}`,
      );
    }
    if (shipment.currentHubId && shipment.currentHubId !== fromHubId) {
      throw ApiError.conflict("fromHubId does not match the shipment's current hub location");
    }

    await tx.hubTransfer.create({
      data: {
        shipmentId,
        fromHubId,
        toHubId,
        status: 'ARRIVED',
        arrivedAt: new Date(),
      },
    });

    return tx.shipment.update({
      where: { id: shipmentId },
      data: {
        currentHubId: toHubId,
        ...(shipment.originHubId === null && { originHubId: fromHubId }),
        statusHistory: {
          create: [
            {
              status: shipment.status,
              note: `Hub transfer: ${fromHub.name} -> ${toHub.name}`,
              location: toHub.name,
              actorUserId: adminUserId,
            },
          ],
        },
      },
      include: shipmentInclude,
    });
  });
}
