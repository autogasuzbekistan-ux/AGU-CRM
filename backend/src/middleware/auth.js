const jwt = require('jsonwebtoken');
const db = require('../database/connection');
const redis = require('../config/redis');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Token topilmadi' });
    }

    const token = authHeader.split(' ')[1];

    // Blacklist tekshirish
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ success: false, message: 'Token bekor qilingan' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await db('users')
      .where({ id: decoded.userId, is_active: true })
      .first();

    if (!user) {
      return res.status(401).json({ success: false, message: 'Foydalanuvchi topilmadi' });
    }

    req.user = user;
    req.organizationId = user.organization_id;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Noto\'g\'ri token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token muddati tugagan' });
    }
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Bu amalni bajarish uchun ruxsat yo\'q',
      });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
