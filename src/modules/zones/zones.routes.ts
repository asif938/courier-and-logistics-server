import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as zonesController from './zones.controller';
import { createZoneSchema, updateZoneSchema } from './zones.validation';

const router = Router();

router.use(authenticate);

router.post('/', authorize('ADMIN'), validate(createZoneSchema), zonesController.createZone);
router.get('/', zonesController.listZones);
router.patch('/:id', authorize('ADMIN'), validate(updateZoneSchema), zonesController.updateZone);
router.delete('/:id', authorize('ADMIN'), zonesController.deleteZone);

export const zoneRoutes = router;
