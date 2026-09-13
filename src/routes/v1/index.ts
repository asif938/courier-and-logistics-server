import { Router } from 'express';
import { authRoutes } from '../../modules/auth/auth.routes';
import { healthRoutes } from '../../modules/health/health.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

// Day 2+: users, zones, hubs, pricing, shipments, payments, notifications, admin routes
// mount here as each module lands, e.g.
// router.use('/users', authenticate, userRoutes);

export const v1Router = router;
