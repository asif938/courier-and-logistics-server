import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';
import * as authService from './auth.service';

export const register = catchAsync(async (req: Request, res: Response) => {
  const user = await authService.registerUser(req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Registration successful',
    data: { user },
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.loginUser(req.body);
  return sendSuccess(res, {
    message: 'Login successful',
    data: result,
  });
});

export const googleAuth = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.loginWithGoogle(req.body.idToken);
  return sendSuccess(res, {
    message: 'Google login successful',
    data: result,
  });
});

export const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const tokens = await authService.refreshTokens(req.body.refreshToken);
  return sendSuccess(res, {
    message: 'Token refreshed successfully',
    data: tokens,
  });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  await authService.logoutUser(req.body.refreshToken);
  return sendSuccess(res, { message: 'Logged out successfully' });
});
