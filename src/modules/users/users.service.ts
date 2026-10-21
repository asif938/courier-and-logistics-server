import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { withForeignKeyConstraintHandling } from '../../utils/prismaErrors';
import { safeUserSelect } from '../../utils/safeUserSelect';
import type {
  CreateAddressInput,
  UpdateAddressInput,
  UpdateProfileInput,
} from './users.validation';

export async function getMyProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...safeUserSelect,
      organization: { select: { id: true, name: true } },
      courierProfile: true,
    },
  });

  if (!user) {
    throw ApiError.notFound('User not found');
  }
  return user;
}

export async function updateMyProfile(userId: string, data: UpdateProfileInput) {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: safeUserSelect,
  });
}

export async function createMyAddress(userId: string, data: CreateAddressInput) {
  return prisma.address.create({
    data: { ...data, userId },
  });
}

export async function listMyAddresses(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateMyAddress(userId: string, addressId: string, data: UpdateAddressInput) {
  const address = await prisma.address.findFirst({ where: { id: addressId, userId } });
  if (!address) {
    throw ApiError.notFound('Address not found');
  }
  return prisma.address.update({ where: { id: addressId }, data });
}

export async function deleteMyAddress(userId: string, addressId: string) {
  const address = await prisma.address.findFirst({ where: { id: addressId, userId } });
  if (!address) {
    throw ApiError.notFound('Address not found');
  }
  await withForeignKeyConstraintHandling(
    () => prisma.address.delete({ where: { id: addressId } }),
    'This address is used by one or more shipments and cannot be deleted',
  );
}
