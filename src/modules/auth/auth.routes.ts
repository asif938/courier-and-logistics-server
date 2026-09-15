import { Router } from 'express';
import { redisRateLimit } from '../../middlewares/redisRateLimit.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as authController from './auth.controller';
import {
  googleAuthSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema,
} from './auth.validation';

const router = Router();

router.use(
  redisRateLimit({
    windowSeconds: 15 * 60,
    limit: 20,
    keyPrefix: 'auth',
    message: 'Too many auth requests, please try again later.',
  }),
);

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/google', validate(googleAuthSchema), authController.googleAuth);
router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshToken);
router.post('/logout', validate(logoutSchema), authController.logout);

export const authRoutes = router;
