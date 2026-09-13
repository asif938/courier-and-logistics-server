import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  const message = err instanceof Error ? err.message : 'Something went wrong';
  if (!env.isProduction) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  return res.status(500).json({
    success: false,
    message: env.isProduction ? 'Something went wrong' : message,
    errors: [],
  });
}
