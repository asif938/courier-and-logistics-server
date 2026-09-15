import { Prisma } from '../generated/prisma/client';
import { ApiError } from './ApiError';

export async function withUniqueConstraintHandling<T>(
  operation: () => Promise<T>,
  conflictMessage: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw ApiError.conflict(conflictMessage);
    }
    throw error;
  }
}
