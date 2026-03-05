const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth');
const db = require('../../database/connection');

router.use(authenticate);

// Tashkilot ma'lumotlari
router.get('/current', async (req, res, next) => {
  try {
    const org = await db('organizations').where({ id: req.organizationId }).first();
    if (!org) return res.status(404).json({ success: false, message: 'Tashkilot topilmadi' });

    const userCount = await db('users').where({ organization_id: req.organizationId, is_active: true }).count('* as count').first();
    res.json({ success: true, data: { ...org, current_users: parseInt(userCount.count) } });
  } catch (error) {
    next(error);
  }
});

// Tashkilot sozlamalarini yangilash
router.put('/current', authorize('admin'), async (req, res, next) => {
  try {
    const { name, phone, email, website, address, city, currency, timezone } = req.body;

    const [org] = await db('organizations')
      .where({ id: req.organizationId })
      .update({ name, phone, email, website, address, city, currency, timezone })
      .returning('*');

    res.json({ success: true, data: org });
  } catch (error) {
    next(error);
  }
});

// Tashkilot sozlamalari (custom fields, pipeline config, va boshqalar)
router.patch('/settings', authorize('admin'), async (req, res, next) => {
  try {
    const org = await db('organizations').where({ id: req.organizationId }).first();
    const newSettings = { ...org.settings, ...req.body };

    const [updated] = await db('organizations')
      .where({ id: req.organizationId })
      .update({ settings: JSON.stringify(newSettings) })
      .returning('settings');

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
