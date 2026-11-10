import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { correlationId } from './middleware/correlationId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter, authLimiter } from './middleware/rateLimiter.js';
import routes from './routes/index.js';
import healthRoutes from './routes/healthRoutes.js';

export function createApp(): Express {
  const app = express();

  // 1. Request Correlation ID
  app.use(correlationId);

  // 2. Production-Grade HTTP Security Headers with CSP
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://apis.google.com',
            'https://www.gstatic.com',
            'https://*.firebaseio.com',
          ],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          mediaSrc: ["'self'", 'blob:', 'https:'],
          connectSrc: [
            "'self'",
            'ws:',
            'wss:',
            'https://*.firebaseio.com',
            'https://identitytoolkit.googleapis.com',
            'https://securetoken.googleapis.com',
            'https://*.amazonaws.com',
          ],
          frameSrc: ["'self'", 'https://*.firebaseapp.com'],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: false,
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
    })
  );

  // 3. CORS configuration
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID', 'X-Correlation-ID'],
      exposedHeaders: ['X-Request-ID'],
    })
  );

  // 4. Safe Body Parsing (1mb limit protects against payload inflation DoS)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 5. Request logging with Correlation ID
  app.use(requestLogger);

  // 6. Rate Limiting
  app.use('/api/auth', authLimiter);
  app.use('/api', apiLimiter);

  // 7. Root & Health endpoints
  app.use('/', healthRoutes);

  // 8. API router
  app.use('/api', routes);

  // 9. 404 Handler for undefined routes
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      requestId: _req.id,
    });
  });

  // 10. Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}
