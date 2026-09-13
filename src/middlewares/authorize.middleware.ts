import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../generated/prisma/client';
import { ApiError } from '../utils/ApiError';

// Must run after `authenticate` on the route so req.user is already populated.
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    return next();
  };
}
