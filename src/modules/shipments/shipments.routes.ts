import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as shipmentsController from './shipments.controller';
import {
  assignCourierSchema,
  createShipmentSchema,
  hubTransferSchema,
  listShipmentsQuerySchema,
  paginationQuerySchema,
  searchShipmentsQuerySchema,
  updateShipmentSchema,
  updateStatusSchema,
} from './shipments.validation';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize('CUSTOMER'),
  validate(createShipmentSchema),
  shipmentsController.createShipment,
);
router.get('/', validate(listShipmentsQuerySchema, 'query'), shipmentsController.listShipments);
router.get(
  '/search',
  validate(searchShipmentsQuerySchema, 'query'),
  shipmentsController.searchShipments,
);
router.get(
  '/my-assigned',
  authorize('COURIER'),
  validate(paginationQuerySchema, 'query'),
  shipmentsController.myAssignedShipments,
);
router.get('/:id', shipmentsController.getShipment);
router.get('/:id/tracking', shipmentsController.getTracking);
router.patch(
  '/:id',
  authorize('CUSTOMER'),
  validate(updateShipmentSchema),
  shipmentsController.updateShipment,
);
router.delete('/:id', authorize('CUSTOMER', 'ADMIN'), shipmentsController.deleteShipment);

router.post('/:id/pickup-request', authorize('CUSTOMER'), shipmentsController.requestPickup);
router.post(
  '/:id/assign-courier',
  authorize('ADMIN'),
  validate(assignCourierSchema),
  shipmentsController.assignCourier,
);
router.patch(
  '/:id/status',
  authorize('COURIER', 'ADMIN'),
  validate(updateStatusSchema),
  shipmentsController.updateStatus,
);
router.post('/:id/cancel', authorize('CUSTOMER', 'ADMIN'), shipmentsController.cancelShipment);
router.post(
  '/:id/hub-transfer',
  authorize('ADMIN'),
  validate(hubTransferSchema),
  shipmentsController.recordHubTransfer,
);

export const shipmentRoutes = router;
