const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const db = require('../../database/connection');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { status, assignedTo, contactId, dealId, dueDate } = req.query;

    let query = db('tasks as t')
      .leftJoin('contacts as c', 't.contact_id', 'c.id')
      .leftJoin('deals as d', 't.deal_id', 'd.id')
      .where({ 't.organization_id': req.organizationId })
      .select(
        't.*',
        db.raw("CONCAT(c.first_name, ' ', c.last_name) as contact_name"),
        'd.title as deal_title'
      )
      .orderBy('t.due_date', 'asc');

    if (req.user.role === 'operator') query = query.where({ 't.assigned_to': req.user.id });
    if (status) query = query.where({ 't.status': status });
    if (assignedTo) query = query.where({ 't.assigned_to': assignedTo });
    if (contactId) query = query.where({ 't.contact_id': contactId });
    if (dealId) query = query.where({ 't.deal_id': dealId });
    if (dueDate) query = query.whereRaw("DATE(t.due_date) = ?", [dueDate]);

    const tasks = await query;
    res.json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, description, type, assignedTo, contactId, dealId, dueDate, priority } = req.body;

    const [task] = await db('tasks').insert({
      organization_id: req.organizationId,
      created_by: req.user.id,
      assigned_to: assignedTo || req.user.id,
      contact_id: contactId,
      deal_id: dealId,
      title,
      description,
      type: type || 'task',
      priority: priority || 'medium',
      due_date: dueDate,
    }).returning('*');

    // Bildirishnoma yuborish
    if (assignedTo && assignedTo !== req.user.id) {
      await db('notifications').insert({
        organization_id: req.organizationId,
        user_id: assignedTo,
        type: 'new_task',
        title: 'Yangi vazifa',
        body: `"${title}" vazifasi sizga tayinlandi`,
        data: { task_id: task.id },
      });
    }

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/complete', async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [task] = await db('tasks')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update({ status: 'completed', completed_at: db.fn.now() })
      .returning('*');

    // Operator statistikasi
    await db('operator_stats')
      .insert({
        user_id: req.user.id,
        organization_id: req.organizationId,
        period_type: 'daily',
        period_date: today,
        tasks_completed: 1,
      })
      .onConflict(['user_id', 'period_type', 'period_date'])
      .merge({ tasks_completed: db.raw('operator_stats.tasks_completed + 1') });

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const [task] = await db('tasks')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update(req.body)
      .returning('*');

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await db('tasks')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .delete();

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
