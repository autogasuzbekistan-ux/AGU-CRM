/**
 * AGU CRM — Broadcast REST API
 */
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth');
const db = require('../../database/connection');
const logger = require('../../config/logger');
const { executeBroadcast, getSegmentContacts } = require('./broadcast.service');

router.use(authenticate);

// Ro'yxat
router.get('/', async (req, res, next) => {
  try {
    const broadcasts = await db('broadcasts as b')
      .leftJoin('users as u', 'b.created_by', 'u.id')
      .where({ 'b.organization_id': req.organizationId })
      .select(
        'b.*',
        db.raw("CONCAT(u.first_name, ' ', u.last_name) as created_by_name")
      )
      .orderBy('b.created_at', 'desc')
      .limit(50);
    res.json({ success: true, data: broadcasts });
  } catch (err) { next(err); }
});

// Bitta
router.get('/:id', async (req, res, next) => {
  try {
    const broadcast = await db('broadcasts')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();
    if (!broadcast) return res.status(404).json({ success: false, message: 'Topilmadi' });

    // Recipients statistikasi
    const stats = await db('broadcast_recipients')
      .where({ broadcast_id: broadcast.id })
      .groupBy('status')
      .select('status', db.raw('count(*) as count'));

    res.json({ success: true, data: { ...broadcast, recipient_stats: stats } });
  } catch (err) { next(err); }
});

// Segment preview — nechta kontakt oladi
router.post('/preview', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { channel = 'all', segment_filters = {} } = req.body;
    const contacts = await getSegmentContacts(req.organizationId, segment_filters, channel);
    res.json({ success: true, data: { total: contacts.length, sample: contacts.slice(0, 5) } });
  } catch (err) { next(err); }
});

// Yangi broadcast yaratish
router.post('/', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { title, message, channel, segment_filters, scheduled_at } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'title va message majburiy' });
    }

    const [broadcast] = await db('broadcasts').insert({
      organization_id: req.organizationId,
      title, message,
      channel: channel || 'all',
      segment_filters: segment_filters || {},
      status: scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: scheduled_at || null,
      created_by: req.userId,
    }).returning('*');

    res.status(201).json({ success: true, data: broadcast });
  } catch (err) { next(err); }
});

// Yangilash (faqat draft)
router.put('/:id', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { title, message, channel, segment_filters, scheduled_at } = req.body;
    const [broadcast] = await db('broadcasts')
      .where({ id: req.params.id, organization_id: req.organizationId, status: 'draft' })
      .update({ title, message, channel, segment_filters, scheduled_at })
      .returning('*');
    if (!broadcast) return res.status(400).json({ success: false, message: 'Faqat draft statusdagi broadcastni tahrirlash mumkin' });
    res.json({ success: true, data: broadcast });
  } catch (err) { next(err); }
});

// YUBORISH — hozir yoki rejadan (POST /:id/send)
router.post('/:id/send', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const broadcast = await db('broadcasts')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();

    if (!broadcast) return res.status(404).json({ success: false, message: 'Topilmadi' });
    if (!['draft', 'scheduled'].includes(broadcast.status)) {
      return res.status(400).json({ success: false, message: 'Bu broadcast allaqachon yuborilgan yoki bekor qilingan' });
    }

    // Darhol javob qaytarish, fon rejimida yuborish
    res.json({
      success: true,
      message: 'Broadcast boshlandi. Natijalar biroz keyin tayyor bo\'ladi.',
      broadcast_id: broadcast.id,
    });

    // Fon
    executeBroadcast(broadcast.id).catch((err) => {
      logger.error(`Broadcast execution error ${broadcast.id}:`, err.message);
    });
  } catch (err) { next(err); }
});

// Bekor qilish
router.post('/:id/cancel', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const [broadcast] = await db('broadcasts')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .whereIn('status', ['draft', 'scheduled', 'sending'])
      .update({ status: 'cancelled' })
      .returning('*');
    if (!broadcast) return res.status(400).json({ success: false, message: 'Bekor qilib bo\'lmadi' });
    res.json({ success: true, data: broadcast });
  } catch (err) { next(err); }
});

// O'chirish (faqat draft/cancelled)
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    await db('broadcasts')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .whereIn('status', ['draft', 'cancelled'])
      .delete();
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
