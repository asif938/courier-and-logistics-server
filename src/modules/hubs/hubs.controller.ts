import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../types/express';
import { sendSuccess } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';
import * as hubsService from './hubs.service';
import type { ListHubsQuery } from './hubs.validation';

export const createHub = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const hub = await hubsService.createHub(req.user.id, req.body, req.ip);
  return sendSuccess(res, { statusCode: 201, message: 'Hub created successfully', data: { hub } });
});

export const listHubs = catchAsync(async (req: Request, res: Response) => {
  const query = (req.validatedQuery ?? {}) as unknown as ListHubsQuery;
  const hubs = await hubsService.listHubs(query);
  return sendSuccess(res, { data: { hubs } });
});

export const updateHub = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const hub = await hubsService.updateHub(req.user.id, req.params.id as string, req.body, req.ip);
  return sendSuccess(res, { message: 'Hub updated successfully', data: { hub } });
});

export const deleteHub = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  await hubsService.softDeleteHub(req.user.id, req.params.id as string, req.ip);
  return sendSuccess(res, { message: 'Hub deleted successfully' });
});
