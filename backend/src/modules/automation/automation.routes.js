/**
 * AGU CRM — Automation Rules REST API
 */
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth');
const db = require('../../database/connection');

router.use(authenticate);

// Barcha qoidalar ro'yxati
router.get('/', async (req, res, next) => {
  try {
    const rules = await db('automation_rules')
      .where({ organization_id: req.organizationId })
      .orderBy('created_at', 'desc');
    res.json({ success: true, data: rules });
  } catch (err) { next(err); }
});

// Bitta qoida
router.get('/:id', async (req, res, next) => {
  try {
    const rule = await db('automation_rules')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();
    if (!rule) return res.status(404).json({ success: false, message: 'Topilmadi' });
    res.json({ success: true, data: rule });
  } catch (err) { next(err); }
});

// Yangi qoida
router.post('/', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { name, description, trigger_event, trigger_conditions, actions, delay_minutes } = req.body;
    if (!name || !trigger_event) {
      return res.status(400).json({ success: false, message: 'name va trigger_event majburiy' });
    }
    const [rule] = await db('automation_rules').insert({
      organization_id: req.organizationId,
      name, description,
      trigger_event,
      trigger_conditions: trigger_conditions || {},
      actions: actions || [],
      delay_minutes: delay_minutes || 0,
      created_by: req.userId,
    }).returning('*');
    res.status(201).json({ success: true, data: rule });
  } catch (err) { next(err); }
});

// Yangilash
router.put('/:id', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { name, description, trigger_event, trigger_conditions, actions, delay_minutes, is_active } = req.body;
    const [rule] = await db('automation_rules')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update({ name, description, trigger_event, trigger_conditions, actions, delay_minutes, is_active })
      .returning('*');
    if (!rule) return res.status(404).json({ success: false, message: 'Topilmadi' });
    res.json({ success: true, data: rule });
  } catch (err) { next(err); }
});

// On/Off toggle
router.patch('/:id/toggle', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const rule = await db('automation_rules')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();
    if (!rule) return res.status(404).json({ success: false, message: 'Topilmadi' });

    const [updated] = await db('automation_rules')
      .where({ id: rule.id })
      .update({ is_active: !rule.is_active })
      .returning('*');
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// O'chirish
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    await db('automation_rules')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .delete();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Logs
router.get('/:id/logs', async (req, res, next) => {
  try {
    const logs = await db('automation_logs')
      .where({ rule_id: req.params.id, organization_id: req.organizationId })
      .orderBy('executed_at', 'desc')
      .limit(50);
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
});

// Trigger events ro'yxati (frontend uchun)
router.get('/meta/events', (req, res) => {
  res.json({
    success: true,
    data: [
      { value: 'lead_created',        label: 'Lead yaratilganda' },
      { value: 'lead_status_changed', label: 'Lead holati o\'zgarganda' },
      { value: 'lead_assigned',       label: 'Lead tayinlanganda' },
      { value: 'deal_created',        label: 'Bitim yaratilganda' },
      { value: 'deal_stage_changed',  label: 'Bitim bosqichi o\'zgarganda' },
      { value: 'deal_won',            label: 'Bitim yutilganda' },
      { value: 'deal_lost',           label: 'Bitim yo\'qotilganda' },
      { value: 'message_received',    label: 'Yangi xabar kelganda' },
      { value: 'contact_created',     label: 'Kontakt yaratilganda' },
    ],
    action_types: [
      { value: 'send_message',       label: 'Mijozga xabar yuborish' },
      { value: 'create_task',        label: 'Vazifa yaratish' },
      { value: 'send_notification',  label: 'Operatorga bildirishnoma' },
      { value: 'add_tag',            label: 'Teg qo\'shish' },
      { value: 'update_lead_status', label: 'Lead holatini o\'zgartirish' },
      { value: 'update_deal_stage',  label: 'Bitim bosqichini o\'zgartirish' },
    ],
  });
});

module.exports = router;
