import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as pricingController from './pricing.controller';
import { createPricingRuleSchema, quoteSchema } from './pricing.validation';

const router = Router();

router.use(authenticate);

router.post('/quote', validate(quoteSchema), pricingController.getQuote);
router.post(
  '/rules',
  authorize('ADMIN'),
  validate(createPricingRuleSchema),
  pricingController.createPricingRule,
);

export const pricingRoutes = router;
