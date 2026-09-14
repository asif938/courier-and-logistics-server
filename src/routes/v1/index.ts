import { Router } from 'express';
import { authRoutes } from '../../modules/auth/auth.routes';
import { courierRoutes } from '../../modules/couriers/couriers.routes';
import { healthRoutes } from '../../modules/health/health.routes';
import { hubRoutes } from '../../modules/hubs/hubs.routes';
import { pricingRoutes } from '../../modules/pricing/pricing.routes';
import { shipmentRoutes } from '../../modules/shipments/shipments.routes';
import { userRoutes } from '../../modules/users/users.routes';
import { zoneRoutes } from '../../modules/zones/zones.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/shipments', shipmentRoutes);
router.use('/zones', zoneRoutes);
router.use('/hubs', hubRoutes);
router.use('/pricing', pricingRoutes);
router.use('/couriers', courierRoutes);

export const v1Router = router;
