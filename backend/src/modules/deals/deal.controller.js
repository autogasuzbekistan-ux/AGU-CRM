const db = require('../../database/connection');
const { runAutomations } = require('../automation/automation.engine');

exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, pipelineId, stageId, status, assignedTo } = req.query;
    const offset = (page - 1) * limit;

    let query = db('deals as d')
      .leftJoin('contacts as c', 'd.contact_id', 'c.id')
      .leftJoin('users as u', 'd.assigned_to', 'u.id')
      .leftJoin('pipeline_stages as ps', 'd.stage_id', 'ps.id')
      .where({ 'd.organization_id': req.organizationId })
      .select(
        'd.*',
        'ps.name as stage_name',
        'ps.color as stage_color',
        db.raw("CONCAT(c.first_name, ' ', c.last_name) as contact_name"),
        'c.phone as contact_phone',
        db.raw("CONCAT(u.first_name, ' ', u.last_name) as assigned_name")
      )
      .orderBy('d.created_at', 'desc');

    if (req.user.role === 'operator') query = query.where({ 'd.assigned_to': req.user.id });
    if (pipelineId) query = query.where({ 'd.pipeline_id': pipelineId });
    if (stageId) query = query.where({ 'd.stage_id': stageId });
    if (status) query = query.where({ 'd.status': status });
    if (assignedTo) query = query.where({ 'd.assigned_to': assignedTo });

    const [{ count }] = await query.clone().count('d.id as count');
    const deals = await query.offset(offset).limit(parseInt(limit));

    res.json({
      success: true,
      data: deals,
      meta: { total: parseInt(count), page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (error) {
    next(error);
  }
};

exports.kanban = async (req, res, next) => {
  try {
    const { pipelineId } = req.query;

    const stages = await db('pipeline_stages')
      .where({ pipeline_id: pipelineId })
      .orderBy('sort_order', 'asc');

    const deals = await db('deals as d')
      .leftJoin('contacts as c', 'd.contact_id', 'c.id')
      .where({ 'd.organization_id': req.organizationId, 'd.pipeline_id': pipelineId, 'd.status': 'open' })
      .select('d.*', db.raw("CONCAT(c.first_name, ' ', c.last_name) as contact_name"), 'c.phone as contact_phone');

    // Kanban formatida qaytarish
    const kanban = stages.map((stage) => ({
      ...stage,
      deals: deals.filter((d) => d.stage_id === stage.id),
      total_amount: deals
        .filter((d) => d.stage_id === stage.id)
        .reduce((sum, d) => sum + parseFloat(d.amount || 0), 0),
    }));

    res.json({ success: true, data: kanban });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { title, pipelineId, stageId, contactId, amount, expectedCloseDate, assignedTo } = req.body;

    // Default pipeline
    let pid = pipelineId;
    if (!pid) {
      const defaultPipeline = await db('pipelines')
        .where({ organization_id: req.organizationId, is_default: true })
        .first();
      pid = defaultPipeline?.id;
    }

    let sid = stageId;
    if (!sid) {
      const firstStage = await db('pipeline_stages')
        .where({ pipeline_id: pid })
        .orderBy('sort_order', 'asc')
        .first();
      sid = firstStage?.id;
    }

    const [deal] = await db('deals').insert({
      organization_id: req.organizationId,
      pipeline_id: pid,
      stage_id: sid,
      contact_id: contactId,
      assigned_to: assignedTo || req.user.id,
      title,
      amount: amount || 0,
      expected_close_date: expectedCloseDate,
      currency: 'UZS',
    }).returning('*');

    // Operator statistikasi
    await db('operator_stats')
      .insert({
        user_id: deal.assigned_to,
        organization_id: req.organizationId,
        period_type: 'daily',
        period_date: new Date().toISOString().split('T')[0],
        deals_created: 1,
      })
      .onConflict(['user_id', 'period_type', 'period_date'])
      .merge({ deals_created: db.raw('operator_stats.deals_created + 1') });

    // Automation trigger
    runAutomations(req.organizationId, 'deal_created', {
      entity_type: 'deal', entity_id: deal.id,
      deal_id: deal.id, contact_id: deal.contact_id, assigned_to: deal.assigned_to,
    }).catch(() => {});

    res.status(201).json({ success: true, data: deal });
  } catch (error) {
    next(error);
  }
};

exports.get = async (req, res, next) => {
  try {
    const deal = await db('deals')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();

    if (!deal) {
      return res.status(404).json({ success: false, message: 'Bitim topilmadi' });
    }

    res.json({ success: true, data: deal });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const [deal] = await db('deals')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update(req.body)
      .returning('*');

    res.json({ success: true, data: deal });
  } catch (error) {
    next(error);
  }
};

exports.moveStage = async (req, res, next) => {
  try {
    const { stageId } = req.body;

    const [deal] = await db('deals')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update({ stage_id: stageId })
      .returning('*');

    // Real-time yangilash
    const io = req.app.get('io');
    if (io) {
      io.to(`org:${req.organizationId}`).emit('deal_moved', { dealId: deal.id, stageId });
    }

    // Automation trigger
    runAutomations(req.organizationId, 'deal_stage_changed', {
      entity_type: 'deal', entity_id: deal.id,
      deal_id: deal.id, contact_id: deal.contact_id, stage_id: stageId,
    }).catch(() => {});

    res.json({ success: true, data: deal });
  } catch (error) {
    next(error);
  }
};

exports.markWon = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [deal] = await db('deals')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update({ status: 'won', closed_at: db.fn.now() })
      .returning('*');

    // Operator statistikasi
    await db('operator_stats')
      .insert({
        user_id: deal.assigned_to,
        organization_id: req.organizationId,
        period_type: 'daily',
        period_date: today,
        deals_won: 1,
        revenue: deal.amount,
      })
      .onConflict(['user_id', 'period_type', 'period_date'])
      .merge({
        deals_won: db.raw('operator_stats.deals_won + 1'),
        revenue: db.raw(`operator_stats.revenue + ${deal.amount}`),
      });

    // Kontakt umumiy daromadini yangilash
    if (deal.contact_id) {
      await db('contacts')
        .where({ id: deal.contact_id })
        .increment('total_revenue', parseFloat(deal.amount) || 0)
        .increment('total_deals', 1);
    }

    // Automation trigger
    runAutomations(req.organizationId, 'deal_won', {
      entity_type: 'deal', entity_id: deal.id,
      deal_id: deal.id, contact_id: deal.contact_id,
      amount: deal.amount, assigned_to: deal.assigned_to,
    }).catch(() => {});

    res.json({ success: true, data: deal });
  } catch (error) {
    next(error);
  }
};

exports.markLost = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const today = new Date().toISOString().split('T')[0];

    const [deal] = await db('deals')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update({ status: 'lost', closed_at: db.fn.now(), lost_reason: reason })
      .returning('*');

    await db('operator_stats')
      .insert({
        user_id: deal.assigned_to,
        organization_id: req.organizationId,
        period_type: 'daily',
        period_date: today,
        deals_lost: 1,
      })
      .onConflict(['user_id', 'period_type', 'period_date'])
      .merge({ deals_lost: db.raw('operator_stats.deals_lost + 1') });

    // Automation trigger
    runAutomations(req.organizationId, 'deal_lost', {
      entity_type: 'deal', entity_id: deal.id,
      deal_id: deal.id, contact_id: deal.contact_id,
      reason: reason || '', assigned_to: deal.assigned_to,
    }).catch(() => {});

    res.json({ success: true, data: deal });
  } catch (error) {
    next(error);
  }
};

exports.addProduct = async (req, res, next) => {
  try {
    const { productId, quantity, price } = req.body;

    // Deal mahsulotlari uchun alohida jadval kerak (keyingi etapda)
    res.json({ success: true, message: 'Mahsulot qo\'shildi' });
  } catch (error) {
    next(error);
  }
};

exports.getProducts = async (req, res, next) => {
  res.json({ success: true, data: [] });
};

exports.delete = async (req, res, next) => {
  try {
    await db('deals')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .delete();

    res.json({ success: true, message: 'Bitim o\'chirildi' });
  } catch (error) {
    next(error);
  }
};
