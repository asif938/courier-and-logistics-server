import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as shipmentsController from './shipments.controller';
import {
  createShipmentSchema,
  listShipmentsQuerySchema,
  updateShipmentSchema,
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
router.get('/:id', shipmentsController.getShipment);
router.patch(
  '/:id',
  authorize('CUSTOMER'),
  validate(updateShipmentSchema),
  shipmentsController.updateShipment,
);
router.delete('/:id', authorize('CUSTOMER', 'ADMIN'), shipmentsController.deleteShipment);

export const shipmentRoutes = router;
