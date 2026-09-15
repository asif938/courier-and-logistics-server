import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as paymentsController from './payments.controller';
import { initiatePaymentSchema, listPaymentsQuerySchema } from './payments.validation';

const router = Router();

router.use(authenticate);

router.post(
  '/initiate',
  authorize('CUSTOMER'),
  validate(initiatePaymentSchema),
  paymentsController.initiatePayment,
);
router.get(
  '/',
  authorize('CUSTOMER', 'ADMIN'),
  validate(listPaymentsQuerySchema, 'query'),
  paymentsController.listPayments,
);
router.get('/:id', authorize('CUSTOMER', 'ADMIN'), paymentsController.getPayment);

export const paymentRoutes = router;
