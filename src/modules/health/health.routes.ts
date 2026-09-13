import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { sendError, sendSuccess } from '../../utils/ApiResponse';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return sendError(res, {
      statusCode: 503,
      message: 'Database connection is unavailable',
    });
  }

  return sendSuccess(res, {
    message: 'Courier & Logistics API is healthy',
    data: {
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
      database: 'connected',
    },
  });
});

export const healthRoutes = router;
