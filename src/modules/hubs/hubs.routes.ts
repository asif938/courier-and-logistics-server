import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as hubsController from './hubs.controller';
import { createHubSchema, listHubsQuerySchema, updateHubSchema } from './hubs.validation';

const router = Router();

router.use(authenticate);

router.post('/', authorize('ADMIN'), validate(createHubSchema), hubsController.createHub);
router.get('/', validate(listHubsQuerySchema, 'query'), hubsController.listHubs);
router.patch('/:id', authorize('ADMIN'), validate(updateHubSchema), hubsController.updateHub);
router.delete('/:id', authorize('ADMIN'), hubsController.deleteHub);

export const hubRoutes = router;
