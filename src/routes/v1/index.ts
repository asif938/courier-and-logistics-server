import { Router } from 'express';
import { authRoutes } from '../../modules/auth/auth.routes';
import { healthRoutes } from '../../modules/health/health.routes';
import { userRoutes } from '../../modules/users/users.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

export const v1Router = router;
