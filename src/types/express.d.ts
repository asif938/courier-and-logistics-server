import type { Request } from 'express';
import type { Role } from '../generated/prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: NonNullable<Request['user']>;
}
