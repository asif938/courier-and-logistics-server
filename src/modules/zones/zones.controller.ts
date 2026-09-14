import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';
import * as zonesService from './zones.service';

export const createZone = catchAsync(async (req: Request, res: Response) => {
  const zone = await zonesService.createZone(req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Zone created successfully',
    data: { zone },
  });
});

export const listZones = catchAsync(async (_req: Request, res: Response) => {
  const zones = await zonesService.listZones();
  return sendSuccess(res, { data: { zones } });
});
