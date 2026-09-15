import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler.middleware';
import { notFoundHandler } from './middlewares/notFound.middleware';
import { redisRateLimit } from './middlewares/redisRateLimit.middleware';
import { stripeWebhook } from './modules/payments/payments.controller';
import { v1Router } from './routes/v1';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  }),
);
app.use(compression());
app.use(morgan(env.isProduction ? 'combined' : 'dev'));

app.post(
  `${env.apiBasePath}/payments/webhook`,
  express.raw({ type: 'application/json' }),
  stripeWebhook,
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  env.apiBasePath,
  redisRateLimit({
    windowSeconds: 15 * 60,
    limit: 300,
    keyPrefix: 'api',
    message: 'Too many requests, please try again later.',
  }),
);

app.use(env.apiBasePath, v1Router);

app.use(notFoundHandler);
app.use(errorHandler);
