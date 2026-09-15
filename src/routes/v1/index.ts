import { Router } from 'express';
import { adminRoutes } from '../../modules/admin/admin.routes';
import { authRoutes } from '../../modules/auth/auth.routes';
import { courierRoutes } from '../../modules/couriers/couriers.routes';
import { healthRoutes } from '../../modules/health/health.routes';
import { hubRoutes } from '../../modules/hubs/hubs.routes';
import { notificationRoutes } from '../../modules/notifications/notifications.routes';
import { paymentRoutes } from '../../modules/payments/payments.routes';
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
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/payments', paymentRoutes);

export const v1Router = router;
