import { Router } from 'express';
import { healthRoutes } from '../../modules/health/health.routes';

const router = Router();

router.use('/health', healthRoutes);

// Day 2+: auth, users, zones, hubs, pricing, shipments, payments, notifications, admin routes
// mount here as each module lands, e.g. router.use('/auth', authRoutes);

export const v1Router = router;
