import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { initSocketServer } from './socket/socketServer.js';
import { prisma } from './database/prisma.js';

const app = createApp();
const httpServer = http.createServer(app);

// Initialize Socket.IO
const io = initSocketServer(httpServer);

const PORT = env.PORT;

const server = httpServer.listen(PORT, () => {
  logger.info(`Atti backend server running on port ${PORT} [${env.NODE_ENV}]`);
  logger.info(`Health check accessible at http://localhost:${PORT}/health`);
  logger.info(`API routes mounted at http://localhost:${PORT}/api`);
});

// Graceful shutdown handling
async function shutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  // Close socket server
  io.close(() => {
    logger.info('Socket.IO connections closed.');
  });

  // Close HTTP server
  server.close(async () => {
    logger.info('HTTP server closed.');

    // Disconnect Prisma
    try {
      await prisma.$disconnect();
      logger.info('Prisma disconnected.');
    } catch (err: any) {
      logger.error('Error during Prisma disconnect:', { message: err?.message });
    }

    process.exit(0);
  });

  // Force shutdown after 10s if hanging
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, force terminating.');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app, httpServer, io };

