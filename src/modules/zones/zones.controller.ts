import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../types/express';
import { sendSuccess } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';
import * as zonesService from './zones.service';

export const createZone = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const zone = await zonesService.createZone(req.user.id, req.body, req.ip);
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

export const updateZone = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const zone = await zonesService.updateZone(
    req.user.id,
    req.params.id as string,
    req.body,
    req.ip,
  );
  return sendSuccess(res, { message: 'Zone updated successfully', data: { zone } });
});

export const deleteZone = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  await zonesService.softDeleteZone(req.user.id, req.params.id as string, req.ip);
  return sendSuccess(res, { message: 'Zone deleted successfully' });
});
