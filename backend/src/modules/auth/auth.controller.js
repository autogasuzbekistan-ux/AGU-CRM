const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const redis = require('../../config/redis');
const logger = require('../../config/logger');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
  return { accessToken, refreshToken };
};

exports.register = async (req, res, next) => {
  try {
    const { organizationName, email, phone, password, firstName, lastName } = req.body;

    if (!organizationName || !email || !password || !firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'Barcha majburiy maydonlarni to\'ldiring' });
    }

    // Email mavjudligini tekshirish
    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
    }

    // Tranzaksiya
    const result = await db.transaction(async (trx) => {
      // Tashkilot yaratish
      const slug = organizationName.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '') + '-' + Date.now();

      const [organization] = await trx('organizations').insert({
        name: organizationName,
        slug,
        currency: 'UZS',
        timezone: 'Asia/Tashkent',
      }).returning('*');

      // Admin foydalanuvchi yaratish
      const passwordHash = await bcrypt.hash(password, 12);
      const [user] = await trx('users').insert({
        organization_id: organization.id,
        email,
        phone,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        role: 'admin',
      }).returning('*');

      // Default pipeline yaratish
      const [pipeline] = await trx('pipelines').insert({
        organization_id: organization.id,
        name: 'Asosiy Pipeline',
        is_default: true,
      }).returning('*');

      await trx('pipeline_stages').insert([
        { pipeline_id: pipeline.id, name: 'Yangi lead', color: '#6366F1', sort_order: 1, probability: 10 },
        { pipeline_id: pipeline.id, name: 'Muloqot boshlandi', color: '#F59E0B', sort_order: 2, probability: 30 },
        { pipeline_id: pipeline.id, name: 'Taklif yuborildi', color: '#3B82F6', sort_order: 3, probability: 60 },
        { pipeline_id: pipeline.id, name: 'Muzokara', color: '#8B5CF6', sort_order: 4, probability: 80 },
        { pipeline_id: pipeline.id, name: 'Yutildi', color: '#10B981', sort_order: 5, probability: 100, is_won: true },
        { pipeline_id: pipeline.id, name: 'Yo\'qotildi', color: '#EF4444', sort_order: 6, probability: 0, is_lost: true },
      ]);

      // Default ombor yaratish
      await trx('warehouses').insert({
        organization_id: organization.id,
        name: 'Asosiy ombor',
        manager_id: user.id,
      });

      return { organization, user };
    });

    const { accessToken, refreshToken } = generateTokens(result.user.id);

    // Refresh token saqlash
    await redis.set(`refresh:${result.user.id}`, refreshToken, 'EX', 30 * 24 * 3600);

    logger.info(`Yangi tashkilot ro'yxatdan o'tdi: ${result.organization.name}`);

    res.status(201).json({
      success: true,
      message: 'Muvaffaqiyatli ro\'yxatdan o\'tdingiz',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.first_name,
          lastName: result.user.last_name,
          role: result.user.role,
          organizationId: result.user.organization_id,
          organizationName: result.organization.name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email va parol kiritilishi shart' });
    }

    const user = await db('users as u')
      .join('organizations as o', 'u.organization_id', 'o.id')
      .where({ 'u.email': email, 'u.is_active': true })
      .select('u.*', 'o.name as org_name', 'o.slug as org_slug')
      .first();

    if (!user) {
      return res.status(401).json({ success: false, message: 'Email yoki parol noto\'g\'ri' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Email yoki parol noto\'g\'ri' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id);

    // Refresh token saqlash
    await redis.set(`refresh:${user.id}`, refreshToken, 'EX', 30 * 24 * 3600);

    // Online status yangilash
    await db('users').where({ id: user.id }).update({
      is_online: true,
      last_seen_at: db.fn.now(),
    });

    res.json({
      success: true,
      message: 'Muvaffaqiyatli kirdingiz',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          firstName: user.first_name,
          lastName: user.last_name,
          avatarUrl: user.avatar_url,
          role: user.role,
          organizationId: user.organization_id,
          organizationName: user.org_name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token topilmadi' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const savedToken = await redis.get(`refresh:${decoded.userId}`);

    if (savedToken !== refreshToken) {
      return res.status(401).json({ success: false, message: 'Noto\'g\'ri refresh token' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);
    await redis.set(`refresh:${decoded.userId}`, newRefreshToken, 'EX', 30 * 24 * 3600);

    res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Noto\'g\'ri token' });
    }
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];

    // Token blacklistga qo'shish (1 kun)
    await redis.set(`blacklist:${token}`, '1', 'EX', 24 * 3600);

    // Refresh token o'chirish
    await redis.del(`refresh:${req.user.id}`);

    // Offline qilish
    await db('users').where({ id: req.user.id }).update({
      is_online: false,
      last_seen_at: db.fn.now(),
    });

    res.json({ success: true, message: 'Muvaffaqiyatli chiqdingiz' });
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await db('users').where({ email }).first();

    // Xavfsizlik uchun har doim success qaytaramiz
    if (user) {
      const resetToken = uuidv4();
      await redis.set(`reset:${resetToken}`, user.id, 'EX', 3600); // 1 soat
      // TODO: Email yuborish
      logger.info(`Parol tiklash tokeni yaratildi: ${user.email}`);
    }

    res.json({ success: true, message: 'Agar email mavjud bo\'lsa, tiklash havolasi yuborildi' });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const userId = await redis.get(`reset:${token}`);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Token noto\'g\'ri yoki muddati tugagan' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db('users').where({ id: userId }).update({ password_hash: passwordHash });
    await redis.del(`reset:${token}`);

    res.json({ success: true, message: 'Parol muvaffaqiyatli yangilandi' });
  } catch (error) {
    next(error);
  }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    const userId = await redis.get(`email_verify:${token}`);

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Token noto\'g\'ri yoki muddati tugagan' });
    }

    await db('users').where({ id: userId }).update({ email_verified_at: db.fn.now() });
    await redis.del(`email_verify:${token}`);

    res.json({ success: true, message: 'Email muvaffaqiyatli tasdiqlandi' });
  } catch (error) {
    next(error);
  }
};

exports.me = async (req, res) => {
  const user = req.user;
  const org = await db('organizations').where({ id: user.organization_id }).first();

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: user.avatar_url,
      role: user.role,
      department: user.department,
      position: user.position,
      telegramUsername: user.telegram_username,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        currency: org.currency,
        timezone: org.timezone,
      },
    },
  });
};

exports.telegramAuth = async (req, res, next) => {
  try {
    const { telegramId, username, firstName, lastName, inviteCode } = req.body;

    let user = await db('users').where({ telegram_id: telegramId }).first();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Telegram akkountingiz tizimda topilmadi. Administrator bilan bog\'laning.',
      });
    }

    const { accessToken, refreshToken } = generateTokens(user.id);
    await redis.set(`refresh:${user.id}`, refreshToken, 'EX', 30 * 24 * 3600);

    res.json({ success: true, data: { accessToken, refreshToken } });
  } catch (error) {
    next(error);
  }
};
