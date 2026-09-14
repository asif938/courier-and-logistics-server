import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/express';
import { sendSuccess } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';
import * as shipmentsService from './shipments.service';
import type { ListShipmentsQuery } from './shipments.validation';

export const createShipment = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const shipment = await shipmentsService.createShipment(req.user.id, req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Shipment created successfully',
    data: { shipment },
  });
});

export const listShipments = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const query = req.validatedQuery as unknown as ListShipmentsQuery;
  const { shipments, meta } = await shipmentsService.listShipments(req.user, query);
  return sendSuccess(res, { data: { shipments, meta } });
});

export const getShipment = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const shipment = await shipmentsService.getShipmentById(req.user, req.params.id as string);
  return sendSuccess(res, { data: { shipment } });
});

export const updateShipment = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const shipment = await shipmentsService.updateShipment(
    req.user,
    req.params.id as string,
    req.body,
  );
  return sendSuccess(res, { message: 'Shipment updated successfully', data: { shipment } });
});

export const deleteShipment = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  await shipmentsService.softDeleteShipment(req.user, req.params.id as string);
  return sendSuccess(res, { message: 'Shipment cancelled successfully' });
});
