const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const logger = require('./config/logger');

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    process.env.APP_URL || 'http://localhost:3000',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { success: false, message: 'Juda ko\'p so\'rov. Keyinroq urinib ko\'ring.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'AGU CRM Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
const apiRouter = require('./routes');
app.use('/api/v1', apiRouter);

// Webhook Routes (rate limit yo'q)
const webhookRouter = require('./routes/webhooks');
app.use('/webhook', webhookRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Marshut topilmadi: ${req.method} ${req.path}`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Xato:', { message: err.message, stack: err.stack, url: req.url });

  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: err.message, errors: err.errors });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ success: false, message: 'Ruxsat yo\'q' });
  }

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Server xatosi' : err.message;

  res.status(statusCode).json({ success: false, message });
});

module.exports = app;
