const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticate, authorize } = require('../../middleware/auth');
const db = require('../../database/connection');

router.use(authenticate);

// Barcha foydalanuvchilar
router.get('/', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const users = await db('users')
      .where({ organization_id: req.organizationId })
      .select('id', 'email', 'phone', 'first_name', 'last_name', 'role',
        'department', 'position', 'avatar_url', 'is_active', 'is_online',
        'last_seen_at', 'telegram_username', 'created_at')
      .orderBy('first_name', 'asc');

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

// Operatorlar reytingi
router.get('/leaderboard', async (req, res, next) => {
  try {
    const { period = 'monthly' } = req.query;
    const now = new Date();
    let periodDate;

    if (period === 'daily') periodDate = now.toISOString().split('T')[0];
    else if (period === 'weekly') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      periodDate = new Date(now.setDate(diff)).toISOString().split('T')[0];
    } else {
      periodDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    }

    const stats = await db('operator_stats as os')
      .join('users as u', 'os.user_id', 'u.id')
      .where({ 'os.organization_id': req.organizationId, 'os.period_type': period, 'os.period_date': periodDate })
      .select(
        'u.id', 'u.first_name', 'u.last_name', 'u.avatar_url',
        'os.leads_received', 'os.leads_converted', 'os.deals_won',
        'os.deals_lost', 'os.revenue', 'os.tasks_completed', 'os.messages_sent', 'os.score'
      )
      .orderBy('os.revenue', 'desc');

    const ranked = stats.map((s, i) => ({ ...s, rank: i + 1 }));
    res.json({ success: true, data: ranked });
  } catch (error) {
    next(error);
  }
});

// Yangi foydalanuvchi yaratish
router.post('/', authorize('admin'), async (req, res, next) => {
  try {
    const { email, phone, password, firstName, lastName, role, department, position, telegramId } = req.body;

    const org = await db('organizations').where({ id: req.organizationId }).first();
    const currentUsers = await db('users').where({ organization_id: req.organizationId }).count('* as count').first();

    if (parseInt(currentUsers.count) >= org.max_users) {
      return res.status(403).json({ success: false, message: `Tarif rejangizda maksimal ${org.max_users} ta foydalanuvchi` });
    }

    const exists = await db('users').where({ organization_id: req.organizationId, email }).first();
    if (exists) {
      return res.status(409).json({ success: false, message: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
    }

    const passwordHash = await bcrypt.hash(password || 'ChangeMe123!', 12);

    const [user] = await db('users').insert({
      organization_id: req.organizationId,
      email, phone,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      role: role || 'operator',
      department, position,
      telegram_id: telegramId || null,
    }).returning('id', 'email', 'first_name', 'last_name', 'role', 'is_active');

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

// Foydalanuvchini yangilash
router.put('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const { firstName, lastName, phone, role, department, position, isActive, telegramId } = req.body;

    const [user] = await db('users')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update({
        first_name: firstName,
        last_name: lastName,
        phone, role, department, position,
        is_active: isActive,
        telegram_id: telegramId,
      })
      .returning('id', 'email', 'first_name', 'last_name', 'role', 'is_active');

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

// Parolni o'zgartirish
router.patch('/change-password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await db('users').where({ id: req.user.id }).first();
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Joriy parol noto\'g\'ri' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db('users').where({ id: req.user.id }).update({ password_hash: passwordHash });

    res.json({ success: true, message: 'Parol muvaffaqiyatli yangilandi' });
  } catch (error) {
    next(error);
  }
});

// Profil yangilash
router.patch('/profile', async (req, res, next) => {
  try {
    const { firstName, lastName, phone, department, position } = req.body;

    const [user] = await db('users')
      .where({ id: req.user.id })
      .update({ first_name: firstName, last_name: lastName, phone, department, position })
      .returning('id', 'email', 'first_name', 'last_name', 'phone', 'role', 'department', 'position');

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

// Foydalanuvchi statistikasi
router.get('/:id/stats', async (req, res, next) => {
  try {
    const stats = await db('operator_stats')
      .where({ user_id: req.params.id, organization_id: req.organizationId })
      .orderBy('period_date', 'desc')
      .limit(30);

    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
