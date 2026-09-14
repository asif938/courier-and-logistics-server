import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/express';
import { sendSuccess } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';
import * as usersService from './users.service';

export const getMe = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const user = await usersService.getMyProfile(req.user.id);
  return sendSuccess(res, { data: { user } });
});

export const updateMe = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const user = await usersService.updateMyProfile(req.user.id, req.body);
  return sendSuccess(res, { message: 'Profile updated successfully', data: { user } });
});

export const createAddress = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const address = await usersService.createMyAddress(req.user.id, req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Address added successfully',
    data: { address },
  });
});

export const listAddresses = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const addresses = await usersService.listMyAddresses(req.user.id);
  return sendSuccess(res, { data: { addresses } });
});
