import { prisma } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import { ApiError } from '../../utils/ApiError';
import type { CreateAddressInput, UpdateProfileInput } from './users.validation';

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.UserSelect;

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
