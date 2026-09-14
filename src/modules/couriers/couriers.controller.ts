import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/express';
import { sendSuccess } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';
import * as couriersService from './couriers.service';
import type { EarningsQuery, UpdateAvailabilityInput } from './couriers.validation';

export const getMyEarnings = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const query = req.validatedQuery as unknown as EarningsQuery;
  const { earnings, meta, totalEarned } = await couriersService.getMyEarnings(req.user.id, query);
  return sendSuccess(res, { data: { earnings, meta, totalEarned } });
});

export const updateMyAvailability = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { isAvailable } = req.body as UpdateAvailabilityInput;
  const profile = await couriersService.updateMyAvailability(req.user.id, isAvailable);
  return sendSuccess(res, {
    message: 'Availability updated successfully',
    data: { courierProfile: profile },
  });
});
