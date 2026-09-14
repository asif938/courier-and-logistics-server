import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as shipmentsController from './shipments.controller';
import {
  assignCourierSchema,
  createShipmentSchema,
  listShipmentsQuerySchema,
  paginationQuerySchema,
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
  '/my-assigned',
  authorize('COURIER'),
  validate(paginationQuerySchema, 'query'),
  shipmentsController.myAssignedShipments,
);
router.get('/:id', shipmentsController.getShipment);
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

export const shipmentRoutes = router;
