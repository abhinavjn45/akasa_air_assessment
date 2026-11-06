import { randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { db } from './config/db.js';
import { env } from './config/env.js';
import { handleError } from './middlewares/errors.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import leaveRoutes from './routes/leave.js';
import { httpError } from './utils/http-error.js';

export const app = express();

app.disable('x-powered-by');
app.use((req, res, next) => {
  req.id = randomUUID();
  res.set('X-Request-Id', req.id);
  req.setTimeout(15000, () => req.destroy());
  res.on('finish', () => console.log(JSON.stringify({
    level: 'info', requestId: req.id, method: req.method,
    route: req.route?.path || 'unmatched', status: res.statusCode,
  })));
  next();
});
app.use(helmet());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).json({
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.', details: [], requestId: req.id },
  }),
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === env.CORS_ORIGIN) return callback(null, true);
    return callback(httpError(403, 'INVALID_ORIGIN', 'The request origin is not allowed.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '16mb' }));
app.use(cookieParser());

app.get('/health', (req, res) => res.json({ data: { status: 'ok' }, meta: { requestId: req.id } }));
app.get('/ready', async (_req, res, next) => {
  try {
    await db.query('SELECT 1');
    return res.json({ data: { status: 'ready' }, meta: { requestId: res.get('X-Request-Id') } });
  } catch {
    return next(httpError(503, 'NOT_READY', 'The service is not ready.'));
  }
});
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/leave-requests', leaveRoutes);
app.use((_req, _res, next) => next(httpError(404, 'NOT_FOUND', 'The requested resource was not found.')));
app.use(handleError);
