const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const db = require('../../database/connection');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unread } = req.query;
    const offset = (page - 1) * limit;

    let query = db('notifications')
      .where({ user_id: req.user.id, organization_id: req.organizationId })
      .orderBy('created_at', 'desc');

    if (unread === 'true') query = query.where({ is_read: false });

    const [{ count }] = await query.clone().count('* as count');
    const notifications = await query.offset(offset).limit(parseInt(limit));
    const unreadCount = await db('notifications')
      .where({ user_id: req.user.id, is_read: false })
      .count('* as count').first();

    res.json({
      success: true,
      data: notifications,
      meta: { total: parseInt(count), unread: parseInt(unreadCount.count), page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/read-all', async (req, res, next) => {
  try {
    await db('notifications')
      .where({ user_id: req.user.id, is_read: false })
      .update({ is_read: true });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    await db('notifications')
      .where({ id: req.params.id, user_id: req.user.id })
      .update({ is_read: true });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
