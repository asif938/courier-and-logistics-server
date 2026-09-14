import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as couriersController from './couriers.controller';
import { earningsQuerySchema, updateAvailabilitySchema } from './couriers.validation';

const router = Router();

router.use(authenticate, authorize('COURIER'));

router.get(
  '/me/earnings',
  validate(earningsQuerySchema, 'query'),
  couriersController.getMyEarnings,
);
router.patch(
  '/me/availability',
  validate(updateAvailabilitySchema),
  couriersController.updateMyAvailability,
);

export const courierRoutes = router;
