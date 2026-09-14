import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/express';
import { sendSuccess } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';
import * as shipmentsService from './shipments.service';
import type {
  AssignCourierInput,
  HubTransferInput,
  ListShipmentsQuery,
  PaginationQuery,
  SearchShipmentsQuery,
  UpdateStatusInput,
} from './shipments.validation';

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

export const searchShipments = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const query = req.validatedQuery as unknown as SearchShipmentsQuery;
  const { shipments, meta } = await shipmentsService.searchShipments(req.user, query);
  return sendSuccess(res, { data: { shipments, meta } });
});

export const getShipment = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const shipment = await shipmentsService.getShipmentById(req.user, req.params.id as string);
  return sendSuccess(res, { data: { shipment } });
});

export const getTracking = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const tracking = await shipmentsService.getShipmentTracking(req.user, req.params.id as string);
  return sendSuccess(res, { data: tracking });
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

export const requestPickup = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const shipment = await shipmentsService.requestPickup(req.user, req.params.id as string);
  return sendSuccess(res, { message: 'Pickup requested successfully', data: { shipment } });
});

export const assignCourier = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { courierId } = req.body as AssignCourierInput;
  const shipment = await shipmentsService.assignCourier(
    req.user.id,
    req.params.id as string,
    courierId,
  );
  return sendSuccess(res, { message: 'Courier assigned successfully', data: { shipment } });
});

export const updateStatus = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { status, note, location } = req.body as UpdateStatusInput;
  const shipment = await shipmentsService.updateShipmentStatus(
    req.user,
    req.params.id as string,
    status,
    note,
    location,
  );
  return sendSuccess(res, { message: 'Shipment status updated successfully', data: { shipment } });
});

export const cancelShipment = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const shipment = await shipmentsService.cancelShipment(req.user, req.params.id as string);
  return sendSuccess(res, { message: 'Shipment cancelled successfully', data: { shipment } });
});

export const myAssignedShipments = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const query = req.validatedQuery as unknown as PaginationQuery;
  const { shipments, meta } = await shipmentsService.listMyAssignedShipments(req.user.id, query);
  return sendSuccess(res, { data: { shipments, meta } });
});

export const recordHubTransfer = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { fromHubId, toHubId } = req.body as HubTransferInput;
  const shipment = await shipmentsService.recordHubTransfer(
    req.user.id,
    req.params.id as string,
    fromHubId,
    toHubId,
  );
  return sendSuccess(res, { message: 'Hub transfer recorded successfully', data: { shipment } });
});
