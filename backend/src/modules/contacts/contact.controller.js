const db = require('../../database/connection');

exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status, source, assignedTo, tag } = req.query;
    const offset = (page - 1) * limit;

    let query = db('contacts')
      .where({ organization_id: req.organizationId })
      .orderBy('created_at', 'desc');

    if (search) {
      query = query.where((qb) => {
        qb.whereRaw("first_name ILIKE ?", [`%${search}%`])
          .orWhereRaw("last_name ILIKE ?", [`%${search}%`])
          .orWhereRaw("phone ILIKE ?", [`%${search}%`])
          .orWhereRaw("email ILIKE ?", [`%${search}%`]);
      });
    }

    if (status) query = query.where({ status });
    if (source) query = query.where({ source });
    if (assignedTo) query = query.where({ assigned_to: assignedTo });
    if (tag) query = query.whereRaw("? = ANY(tags)", [tag]);

    const [{ count }] = await query.clone().count('* as count');
    const contacts = await query.offset(offset).limit(limit);

    res.json({
      success: true,
      data: contacts,
      meta: { total: parseInt(count), page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, email, source, telegramId, whatsappPhone, tags, notes } = req.body;

    if (!phone && !email && !telegramId) {
      return res.status(400).json({ success: false, message: 'Telefon, email yoki Telegram ID kiritilishi shart' });
    }

    const [contact] = await db('contacts').insert({
      organization_id: req.organizationId,
      assigned_to: req.user.id,
      first_name: firstName,
      last_name: lastName,
      phone,
      email,
      source: source || 'manual',
      telegram_id: telegramId,
      whatsapp_phone: whatsappPhone,
      tags: tags || [],
      notes,
    }).returning('*');

    // Operator statistikasini yangilash
    await updateOperatorStats(req.user.id);

    res.status(201).json({ success: true, data: contact });
  } catch (error) {
    next(error);
  }
};

exports.get = async (req, res, next) => {
  try {
    const contact = await db('contacts')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Mijoz topilmadi' });
    }

    res.json({ success: true, data: contact });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const [contact] = await db('contacts')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update(req.body)
      .returning('*');

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Mijoz topilmadi' });
    }

    res.json({ success: true, data: contact });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    await db('contacts')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .delete();

    res.json({ success: true, message: 'Mijoz o\'chirildi' });
  } catch (error) {
    next(error);
  }
};

exports.search = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const contacts = await db('contacts')
      .where({ organization_id: req.organizationId })
      .where((qb) => {
        qb.whereRaw("first_name ILIKE ?", [`%${q}%`])
          .orWhereRaw("last_name ILIKE ?", [`%${q}%`])
          .orWhereRaw("phone ILIKE ?", [`%${q}%`])
          .orWhereRaw("email ILIKE ?", [`%${q}%`]);
      })
      .limit(10);

    res.json({ success: true, data: contacts });
  } catch (error) {
    next(error);
  }
};

exports.assign = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const [contact] = await db('contacts')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update({ assigned_to: userId })
      .returning('*');

    res.json({ success: true, data: contact });
  } catch (error) {
    next(error);
  }
};

exports.history = async (req, res, next) => {
  try {
    const logs = await db('audit_logs')
      .where({ entity_type: 'contact', entity_id: req.params.id, organization_id: req.organizationId })
      .orderBy('created_at', 'desc')
      .limit(50);

    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};

exports.conversations = async (req, res, next) => {
  try {
    const conversations = await db('conversations')
      .where({ contact_id: req.params.id, organization_id: req.organizationId })
      .orderBy('last_message_at', 'desc');

    res.json({ success: true, data: conversations });
  } catch (error) {
    next(error);
  }
};

exports.deals = async (req, res, next) => {
  try {
    const deals = await db('deals')
      .where({ contact_id: req.params.id, organization_id: req.organizationId })
      .orderBy('created_at', 'desc');

    res.json({ success: true, data: deals });
  } catch (error) {
    next(error);
  }
};

exports.tasks = async (req, res, next) => {
  try {
    const tasks = await db('tasks')
      .where({ contact_id: req.params.id, organization_id: req.organizationId })
      .orderBy('due_date', 'asc');

    res.json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
};

async function updateOperatorStats(userId) {
  const today = new Date().toISOString().split('T')[0];
  await db('operator_stats')
    .insert({
      user_id: userId,
      organization_id: (await db('users').where({ id: userId }).select('organization_id').first()).organization_id,
      period_type: 'daily',
      period_date: today,
      leads_received: 1,
    })
    .onConflict(['user_id', 'period_type', 'period_date'])
    .merge({ leads_received: db.raw('operator_stats.leads_received + 1') });
}
