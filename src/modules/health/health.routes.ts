import { Router } from 'express';
import { sendSuccess } from '../../utils/ApiResponse';

const router = Router();

router.get('/', (_req, res) => {
  sendSuccess(res, {
    message: 'Courier & Logistics API is healthy',
    data: { uptimeSeconds: process.uptime(), timestamp: new Date().toISOString() },
  });
});

export const healthRoutes = router;
