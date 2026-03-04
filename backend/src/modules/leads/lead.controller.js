const db = require('../../database/connection');

exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, source, assignedTo, priority } = req.query;
    const offset = (page - 1) * limit;
    const orgId = req.organizationId;

    // Operator faqat o'zining leadlarini ko'radi
    let query = db('leads as l')
      .leftJoin('contacts as c', 'l.contact_id', 'c.id')
      .leftJoin('users as u', 'l.assigned_to', 'u.id')
      .where({ 'l.organization_id': orgId })
      .select(
        'l.*',
        db.raw("CONCAT(c.first_name, ' ', c.last_name) as contact_name"),
        'c.phone as contact_phone',
        db.raw("CONCAT(u.first_name, ' ', u.last_name) as assigned_name")
      )
      .orderBy('l.created_at', 'desc');

    if (req.user.role === 'operator') {
      query = query.where({ 'l.assigned_to': req.user.id });
    }

    if (status) query = query.where({ 'l.status': status });
    if (source) query = query.where({ 'l.source': source });
    if (assignedTo) query = query.where({ 'l.assigned_to': assignedTo });
    if (priority) query = query.where({ 'l.priority': priority });

    const [{ count }] = await query.clone().count('l.id as count');
    const leads = await query.offset(offset).limit(parseInt(limit));

    res.json({
      success: true,
      data: leads,
      meta: { total: parseInt(count), page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { title, description, source, contactId, budget, priority, assignedTo, tags } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Sarlavha kiritilishi shart' });
    }

    // Avtomatik tayinlash (round-robin)
    let operatorId = assignedTo;
    if (!operatorId && (req.user.role === 'admin' || req.user.role === 'manager')) {
      operatorId = await autoAssignOperator(req.organizationId);
    } else if (!operatorId) {
      operatorId = req.user.id;
    }

    const [lead] = await db('leads').insert({
      organization_id: req.organizationId,
      contact_id: contactId,
      assigned_to: operatorId,
      title,
      description,
      source: source || 'manual',
      budget,
      priority: priority || 'medium',
      tags: tags || [],
    }).returning('*');

    // Operator statistikasi
    await db('operator_stats')
      .insert({
        user_id: operatorId,
        organization_id: req.organizationId,
        period_type: 'daily',
        period_date: new Date().toISOString().split('T')[0],
        leads_received: 1,
      })
      .onConflict(['user_id', 'period_type', 'period_date'])
      .merge({ leads_received: db.raw('operator_stats.leads_received + 1') });

    // Real-time bildirishnoma
    const io = req.app.get('io');
    if (io && operatorId) {
      io.to(`user:${operatorId}`).emit('new_lead', { lead });
    }

    res.status(201).json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
};

exports.get = async (req, res, next) => {
  try {
    const lead = await db('leads')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead topilmadi' });
    }

    res.json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const [lead] = await db('leads')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update(req.body)
      .returning('*');

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead topilmadi' });
    }

    res.json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    const updateData = { status };

    if (status === 'rejected') updateData.rejected_reason = reason;

    const [lead] = await db('leads')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update(updateData)
      .returning('*');

    res.json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
};

exports.assign = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const [lead] = await db('leads')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update({ assigned_to: userId })
      .returning('*');

    res.json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
};

exports.convertToDeal = async (req, res, next) => {
  try {
    const { pipelineId, stageId, amount, title } = req.body;

    const lead = await db('leads')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead topilmadi' });
    }

    const result = await db.transaction(async (trx) => {
      const [deal] = await trx('deals').insert({
        organization_id: req.organizationId,
        pipeline_id: pipelineId,
        stage_id: stageId,
        contact_id: lead.contact_id,
        assigned_to: lead.assigned_to,
        lead_id: lead.id,
        title: title || lead.title,
        amount: amount || lead.budget,
        source: lead.source,
        tags: lead.tags,
      }).returning('*');

      await trx('leads')
        .where({ id: lead.id })
        .update({
          status: 'converted',
          converted_at: trx.fn.now(),
          converted_deal_id: deal.id,
        });

      return deal;
    });

    res.json({ success: true, data: result, message: 'Lead bitimga aylandi' });
  } catch (error) {
    next(error);
  }
};

exports.stats = async (req, res, next) => {
  try {
    const stats = await db('leads')
      .where({ organization_id: req.organizationId })
      .select(db.raw("status, COUNT(*) as count"))
      .groupBy('status');

    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    await db('leads')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .delete();

    res.json({ success: true, message: 'Lead o\'chirildi' });
  } catch (error) {
    next(error);
  }
};

// Round-robin tayinlash
async function autoAssignOperator(organizationId) {
  const today = new Date().toISOString().split('T')[0];

  const operators = await db('users')
    .leftJoin('operator_stats as os', function () {
      this.on('users.id', 'os.user_id')
        .andOn('os.period_type', db.raw("'daily'"))
        .andOn('os.period_date', db.raw("?", [today]));
    })
    .where({ 'users.organization_id': organizationId, 'users.role': 'operator', 'users.is_active': true })
    .select('users.id', db.raw('COALESCE(os.leads_received, 0) as leads_count'))
    .orderBy('leads_count', 'asc')
    .first();

  return operators?.id;
}
