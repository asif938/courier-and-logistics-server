import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as contactController from './contact.controller';
import { contactMessageSchema, updateContactSettingsSchema } from './contact.validation';

const router = Router();

router.get('/settings', contactController.getSettings);
router.patch(
  '/settings',
  authenticate,
  authorize('ADMIN'),
  validate(updateContactSettingsSchema),
  contactController.updateSettings,
);
router.post('/', validate(contactMessageSchema), contactController.submitMessage);

export const contactRoutes = router;
