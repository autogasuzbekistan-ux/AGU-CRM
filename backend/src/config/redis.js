const Redis = require('ioredis');
const logger = require('./logger');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error('Redis ga ulashda xato. Ulanish to\'xtatildi.');
      return null;
    }
    return Math.min(times * 100, 3000);
  },
  lazyConnect: true,
});

redis.on('connect', () => logger.info('Redis ga ulandi'));
redis.on('error', (err) => logger.error('Redis xatosi:', err));

module.exports = redis;
