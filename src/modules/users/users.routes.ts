import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as usersController from './users.controller';
import { createAddressSchema, updateAddressSchema, updateProfileSchema } from './users.validation';

const router = Router();

router.use(authenticate);

router.get('/me', usersController.getMe);
router.patch('/me', validate(updateProfileSchema), usersController.updateMe);

router.post(
  '/me/addresses',
  authorize('CUSTOMER'),
  validate(createAddressSchema),
  usersController.createAddress,
);
router.get('/me/addresses', authorize('CUSTOMER'), usersController.listAddresses);
router.patch(
  '/me/addresses/:id',
  authorize('CUSTOMER'),
  validate(updateAddressSchema),
  usersController.updateAddress,
);
router.delete('/me/addresses/:id', authorize('CUSTOMER'), usersController.deleteAddress);

export const userRoutes = router;
