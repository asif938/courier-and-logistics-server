import type { Response } from 'express';

export function sendSuccess<T>(
  res: Response,
  {
    statusCode = 200,
    message = 'Operation successful',
    data,
  }: {
    statusCode?: number;
    message?: string;
    data?: T;
  } = {},
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data: data ?? {},
  });
}

export function sendError(
  res: Response,
  { statusCode = 500, message = 'Something went wrong', errors = [] as unknown[] },
) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
}
