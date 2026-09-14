import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';
import { verifyAccessToken } from '../utils/jwt';

export const authenticate = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Authentication token is missing');
  }

  const token = header.slice('Bearer '.length);

  let payload: { sub: string };
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, deletedAt: null },
    select: { id: true, role: true, isActive: true },
  });

  if (!user?.isActive) {
    throw ApiError.unauthorized('Invalid or expired access token');
  }

  req.user = { id: user.id, role: user.role };
  next();
});
