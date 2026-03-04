const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth');
const db = require('../../database/connection');

router.use(authenticate);

// Dashboard umumiy statistika
router.get('/dashboard', async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7) + '-01';

    const [leads, deals, revenue, contacts] = await Promise.all([
      db('leads').where({ organization_id: orgId }).count('* as count').first(),
      db('deals').where({ organization_id: orgId, status: 'open' }).count('* as count').first(),
      db('deals').where({ organization_id: orgId, status: 'won' })
        .whereRaw("closed_at >= ?", [thisMonth])
        .sum('amount as total').first(),
      db('contacts').where({ organization_id: orgId }).count('* as count').first(),
    ]);

    // Bugungi faollik
    const todayLeads = await db('leads')
      .where({ organization_id: orgId })
      .whereRaw("DATE(created_at) = ?", [today])
      .count('* as count').first();

    const todayDeals = await db('deals')
      .where({ organization_id: orgId, status: 'won' })
      .whereRaw("DATE(closed_at) = ?", [today])
      .sum('amount as total').first();

    res.json({
      success: true,
      data: {
        totalLeads: parseInt(leads.count),
        openDeals: parseInt(deals.count),
        monthlyRevenue: parseFloat(revenue.total || 0),
        totalContacts: parseInt(contacts.count),
        todayLeads: parseInt(todayLeads.count),
        todayRevenue: parseFloat(todayDeals.total || 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Operatorlar reytingi (raqobat)
router.get('/leaderboard', async (req, res, next) => {
  try {
    const { period = 'monthly', date } = req.query;
    const periodDate = date || getPeriodDate(period);

    const stats = await db('operator_stats as os')
      .join('users as u', 'os.user_id', 'u.id')
      .where({ 'os.organization_id': req.organizationId, 'os.period_type': period, 'os.period_date': periodDate })
      .select(
        'os.*',
        db.raw("CONCAT(u.first_name, ' ', u.last_name) as operator_name"),
        'u.avatar_url',
        'u.telegram_username'
      )
      .orderBy('os.revenue', 'desc');

    // Rank qo'shish
    const ranked = stats.map((s, i) => ({ ...s, rank: i + 1 }));

    res.json({ success: true, data: ranked });
  } catch (error) {
    next(error);
  }
});

// Savdo trendi
router.get('/sales-trend', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;

    const trend = await db('deals')
      .where({ organization_id: req.organizationId, status: 'won' })
      .whereRaw("closed_at >= NOW() - INTERVAL '? days'", [parseInt(days)])
      .select(db.raw("DATE(closed_at) as date, COUNT(*) as count, SUM(amount) as revenue"))
      .groupByRaw("DATE(closed_at)")
      .orderBy('date', 'asc');

    res.json({ success: true, data: trend });
  } catch (error) {
    next(error);
  }
});

// Lead manbalari
router.get('/lead-sources', async (req, res, next) => {
  try {
    const sources = await db('leads')
      .where({ organization_id: req.organizationId })
      .select(db.raw("source, COUNT(*) as count, COUNT(CASE WHEN status='converted' THEN 1 END) as converted"))
      .groupBy('source')
      .orderBy('count', 'desc');

    res.json({ success: true, data: sources });
  } catch (error) {
    next(error);
  }
});

// Ombor hisoboti
router.get('/warehouse', async (req, res, next) => {
  try {
    const stockReport = await db('stock as s')
      .join('products as p', 's.product_id', 'p.id')
      .join('warehouses as w', 's.warehouse_id', 'w.id')
      .where({ 'p.organization_id': req.organizationId })
      .select(
        'p.name as product_name',
        'p.sku',
        'p.unit',
        'p.price',
        'p.min_stock',
        'w.name as warehouse_name',
        's.quantity',
        's.reserved_quantity',
        db.raw("s.quantity - s.reserved_quantity as available"),
        db.raw("CASE WHEN s.quantity <= p.min_stock THEN true ELSE false END as low_stock")
      )
      .orderBy('low_stock', 'desc');

    res.json({ success: true, data: stockReport });
  } catch (error) {
    next(error);
  }
});

// Kanal statistikasi
router.get('/channels', async (req, res, next) => {
  try {
    const channels = await db('conversations')
      .where({ organization_id: req.organizationId })
      .select(db.raw("channel, COUNT(*) as conversations, COUNT(CASE WHEN status='resolved' THEN 1 END) as resolved"))
      .groupBy('channel')
      .orderBy('conversations', 'desc');

    res.json({ success: true, data: channels });
  } catch (error) {
    next(error);
  }
});

function getPeriodDate(period) {
  const now = new Date();
  if (period === 'daily') return now.toISOString().split('T')[0];
  if (period === 'weekly') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.setDate(diff)).toISOString().split('T')[0];
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

module.exports = router;
