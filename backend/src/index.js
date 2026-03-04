require('dotenv').config();
const app = require('./app');
const { createServer } = require('http');
const { Server } = require('socket.io');
const logger = require('./config/logger');
const db = require('./database/connection');
const redis = require('./config/redis');

const PORT = process.env.BACKEND_PORT || 3000;

const httpServer = createServer(app);

// Socket.IO - Real-time uchun
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Socket.IO ni app ga ulash
app.set('io', io);

// Socket.IO handlers
require('./modules/realtime/socket.handler')(io);

// Start server
const start = async () => {
  try {
    // DB ulanishini tekshirish
    await db.raw('SELECT 1');
    logger.info('PostgreSQL ga muvaffaqiyatli ulandi');

    // Redis ulanishini tekshirish
    await redis.ping();
    logger.info('Redis ga muvaffaqiyatli ulandi');

    httpServer.listen(PORT, () => {
      logger.info(`AGU CRM Backend serveri ${PORT} portda ishga tushdi`);
      logger.info(`Muhit: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`API: http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    logger.error('Server ishga tushmadi:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal olindi. Server yopilmoqda...');
  httpServer.close(async () => {
    await db.destroy();
    await redis.quit();
    logger.info('Server muvaffaqiyatli yopildi');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Kutilmagan xato:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Ishlov berilmagan promise rejection:', reason);
  process.exit(1);
});

start();
