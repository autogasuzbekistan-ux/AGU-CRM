/**
 * AGU CRM — Invoices & Payment REST API
 * Payme va Click to'lov tizimi bilan integratsiya
 */
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth');
const db = require('../../database/connection');
const logger = require('../../config/logger');

router.use(authenticate);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Payme Checkout URL generatsiya
 * Summa tiyin (UZS * 100)
 */
function generatePaymeUrl(invoice) {
  const merchantId = process.env.PAYME_MERCHANT_ID;
  if (!merchantId) return null;

  const amountTiyin = Math.round(parseFloat(invoice.amount) * 100);
  const params = {
    m: merchantId,
    ac: JSON.stringify({ invoice_id: invoice.id, order: invoice.invoice_number }),
    a: amountTiyin,
    l: 'uz',
    c: `${process.env.APP_URL}/invoices/${invoice.id}/callback`,
  };

  const encoded = Buffer.from(JSON.stringify(params)).toString('base64');
  return `https://checkout.paycom.uz/${encoded}`;
}

/**
 * Click to'lov URL generatsiya
 */
function generateClickUrl(invoice) {
  const serviceId = process.env.CLICK_SERVICE_ID;
  const merchantId = process.env.CLICK_MERCHANT_ID;
  if (!serviceId || !merchantId) return null;

  const params = new URLSearchParams({
    service_id: serviceId,
    merchant_id: merchantId,
    amount: invoice.amount,
    transaction_param: invoice.id,
    return_url: `${process.env.APP_URL}/invoices/${invoice.id}`,
  });

  return `https://my.click.uz/services/pay?${params.toString()}`;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Ro'yxat
router.get('/', async (req, res, next) => {
  try {
    const { status, contactId, dealId } = req.query;

    let query = db('invoices as i')
      .leftJoin('contacts as c', 'i.contact_id', 'c.id')
      .leftJoin('deals as d', 'i.deal_id', 'd.id')
      .leftJoin('users as u', 'i.created_by', 'u.id')
      .where({ 'i.organization_id': req.organizationId })
      .select(
        'i.*',
        db.raw("CONCAT(c.first_name, ' ', c.last_name) as contact_name"),
        'c.phone as contact_phone',
        'd.title as deal_title',
        db.raw("CONCAT(u.first_name, ' ', u.last_name) as created_by_name")
      )
      .orderBy('i.created_at', 'desc');

    if (status) query = query.where({ 'i.status': status });
    if (contactId) query = query.where({ 'i.contact_id': contactId });
    if (dealId) query = query.where({ 'i.deal_id': dealId });

    const invoices = await query.limit(100);
    res.json({ success: true, data: invoices });
  } catch (err) { next(err); }
});

// Bitta
router.get('/:id', async (req, res, next) => {
  try {
    const invoice = await db('invoices as i')
      .leftJoin('contacts as c', 'i.contact_id', 'c.id')
      .leftJoin('deals as d', 'i.deal_id', 'd.id')
      .where({ 'i.id': req.params.id, 'i.organization_id': req.organizationId })
      .select('i.*',
        db.raw("CONCAT(c.first_name, ' ', c.last_name) as contact_name"),
        'c.phone as contact_phone', 'c.telegram_id',
        'd.title as deal_title')
      .first();
    if (!invoice) return res.status(404).json({ success: false, message: 'Topilmadi' });
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
});

// Yaratish
router.post('/', async (req, res, next) => {
  try {
    const { title, deal_id, contact_id, amount, currency, items, notes, due_date, payment_provider } = req.body;
    if (!title || !amount) {
      return res.status(400).json({ success: false, message: 'title va amount majburiy' });
    }

    const [invoice] = await db('invoices').insert({
      organization_id: req.organizationId,
      title, deal_id, contact_id,
      amount: parseFloat(amount),
      currency: currency || 'UZS',
      items: items || [],
      notes,
      due_date: due_date || null,
      payment_provider: payment_provider || 'payme',
      created_by: req.userId,
    }).returning('*');

    // To'lov URL generatsiya
    let paymentUrl = null;
    if (invoice.payment_provider === 'payme') {
      paymentUrl = generatePaymeUrl(invoice);
    } else if (invoice.payment_provider === 'click') {
      paymentUrl = generateClickUrl(invoice);
    }

    if (paymentUrl) {
      const [updated] = await db('invoices')
        .where({ id: invoice.id })
        .update({ payment_url: paymentUrl })
        .returning('*');
      return res.status(201).json({ success: true, data: updated });
    }

    res.status(201).json({ success: true, data: invoice });
  } catch (err) { next(err); }
});

// Yangilash
router.put('/:id', async (req, res, next) => {
  try {
    const { title, amount, items, notes, due_date, payment_provider } = req.body;
    const [invoice] = await db('invoices')
      .where({ id: req.params.id, organization_id: req.organizationId, status: 'draft' })
      .update({ title, amount, items, notes, due_date, payment_provider })
      .returning('*');
    if (!invoice) return res.status(400).json({ success: false, message: 'Faqat draft statusdagi fakturani tahrirlash mumkin' });
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
});

// To'lov URL qayta generatsiya
router.post('/:id/generate-url', async (req, res, next) => {
  try {
    const { provider } = req.body;
    const invoice = await db('invoices')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();
    if (!invoice) return res.status(404).json({ success: false, message: 'Topilmadi' });

    const prov = provider || invoice.payment_provider || 'payme';
    let url = null;
    if (prov === 'payme') url = generatePaymeUrl(invoice);
    else if (prov === 'click') url = generateClickUrl(invoice);

    if (!url) return res.status(400).json({ success: false, message: 'To\'lov provayderi sozlanmagan' });

    const [updated] = await db('invoices')
      .where({ id: invoice.id })
      .update({ payment_url: url, payment_provider: prov })
      .returning('*');

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// Fakturani mijozga yuborish (WhatsApp/Telegram)
router.post('/:id/send', async (req, res, next) => {
  try {
    const invoice = await db('invoices as i')
      .leftJoin('contacts as c', 'i.contact_id', 'c.id')
      .where({ 'i.id': req.params.id, 'i.organization_id': req.organizationId })
      .select('i.*', 'c.telegram_id', 'c.phone',
        db.raw("CONCAT(c.first_name, ' ', c.last_name) as contact_name"))
      .first();

    if (!invoice) return res.status(404).json({ success: false, message: 'Topilmadi' });
    if (!invoice.payment_url) return res.status(400).json({ success: false, message: 'Avval to\'lov URL yarating' });

    const { sendMessage } = require('../integrations/message.service');
    const text = `💳 *Hisob-faktura: ${invoice.invoice_number}*\n\n` +
      `Miqdor: ${Number(invoice.amount).toLocaleString('uz-UZ')} ${invoice.currency}\n` +
      `${invoice.due_date ? `Muddat: ${new Date(invoice.due_date).toLocaleDateString('uz-UZ')}\n` : ''}` +
      `\n💰 To\'lov qilish uchun: ${invoice.payment_url}`;

    // Telegram yoki WhatsApp orqali yuborish
    const channel = invoice.telegram_id ? 'telegram' : 'whatsapp';
    const channelId = invoice.telegram_id || invoice.phone;

    if (!channelId) {
      return res.status(400).json({ success: false, message: 'Kontaktda kanal ma\'lumoti yo\'q' });
    }

    await sendMessage(req.organizationId, channel, channelId, text);
    await db('invoices').where({ id: invoice.id }).update({ sent_at: new Date() });

    logger.info(`Invoice sent: ${invoice.invoice_number} to ${channel}:${channelId}`);
    res.json({ success: true, message: 'Faktura yuborildi' });
  } catch (err) { next(err); }
});

// Qo'lda to'landi deb belgilash
router.patch('/:id/mark-paid', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { transaction_id } = req.body;
    const [invoice] = await db('invoices')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update({ status: 'paid', paid_at: new Date(), transaction_id: transaction_id || null })
      .returning('*');
    if (!invoice) return res.status(404).json({ success: false, message: 'Topilmadi' });
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
});

// Bekor qilish
router.patch('/:id/cancel', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const [invoice] = await db('invoices')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .whereNotIn('status', ['paid', 'cancelled'])
      .update({ status: 'cancelled' })
      .returning('*');
    if (!invoice) return res.status(400).json({ success: false, message: 'Bekor qilib bo\'lmadi' });
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
});

// ── Payme webhook ─────────────────────────────────────────────────────────────
router.post('/webhook/payme', express.json(), async (req, res) => {
  try {
    const { method, params } = req.body;
    logger.info('Payme webhook:', method);

    if (method === 'PerformTransaction') {
      const invoiceId = params?.account?.invoice_id;
      if (invoiceId) {
        await db('invoices').where({ id: invoiceId }).update({
          status: 'paid',
          paid_at: new Date(),
          transaction_id: params.id,
          provider_data: JSON.stringify(params),
        });
      }
    }

    res.json({ result: { transaction: params?.id, perform_time: Date.now(), state: 2 } });
  } catch (err) {
    res.json({ error: { code: -32400, message: 'Server error' } });
  }
});

// ── Click webhook ─────────────────────────────────────────────────────────────
router.post('/webhook/click', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { click_trans_id, service_id, click_paydoc_id, merchant_trans_id, amount, error } = req.body;
    logger.info('Click webhook:', click_trans_id);

    if (parseInt(error) === 0) {
      await db('invoices').where({ id: merchant_trans_id }).update({
        status: 'paid',
        paid_at: new Date(),
        transaction_id: click_trans_id,
        provider_data: JSON.stringify(req.body),
      });
    }

    res.json({ click_trans_id, merchant_trans_id, error: 0, error_note: 'Success' });
  } catch (err) {
    res.json({ error: -9, error_note: 'Failed' });
  }
});

module.exports = router;
