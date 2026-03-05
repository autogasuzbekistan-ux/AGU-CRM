/**
 * AGU AI — Product Recommender (Mahsulot Tavsiyasi)
 * Mijoz profili va suhbat tarixiga qarab mahsulot tavsiya qiladi
 */
const aguAI = require('../ai.service');
const db = require('../../../database/connection');

const SYSTEM = `Siz CRM tizimida mahsulot tavsiyasi beruvchi AI siz.
Mijoz ma'lumotlari va ombordagi mahsulotlar asosida eng mos 3-5 ta mahsulot tanlang.

Javobni FAQAT quyidagi JSON formatida bering:
{
  "recommendations": [
    {
      "product_id": "uuid",
      "product_name": "Mahsulot nomi",
      "reason": "Nima uchun bu mahsulot mos ekanligi (1 gap)",
      "confidence": 0.92,
      "priority": 1
    }
  ],
  "strategy": "upsell",
  "pitch": "Operatorga tavsiya: mijozga qanday taqdim qilish bo'yicha 1-2 gap"
}
strategy: upsell | cross_sell | replacement | bundle | first_purchase
confidence: 0-1 orasida (qanchalik mos ekanligi)`;

/**
 * Mahsulot tavsiyasi berish
 * @param {string} contactId - Mijoz ID
 * @param {string} organizationId - Tashkilot ID
 * @param {string} conversationText - Suhbat matni (ixtiyoriy)
 */
async function recommendProducts(contactId, organizationId, conversationText = '') {
  // Mijoz tarixini olish
  const contact = await db('contacts').where({ id: contactId }).first();

  // Oldingi bitimlarni olish
  const pastDeals = await db('deals as d')
    .leftJoin('pipeline_stages as ps', 'd.stage_id', 'ps.id')
    .where({ 'd.contact_id': contactId })
    .select('d.title', 'd.amount', 'd.status', 'ps.name as stage')
    .limit(5);

  // Mavjud mahsulotlar va qoldiqlarni olish
  const products = await db('products as p')
    .leftJoin('stock as s', function () {
      this.on('p.id', 's.product_id');
    })
    .leftJoin('product_categories as cat', 'p.category_id', 'cat.id')
    .where({ 'p.organization_id': organizationId, 'p.is_active': true })
    .whereRaw('COALESCE(s.quantity, 0) > 0')
    .select(
      'p.id', 'p.name', 'p.description', 'p.price', 'p.unit',
      'cat.name as category',
      db.raw('COALESCE(s.quantity, 0) as stock')
    )
    .limit(30);

  if (!products.length) {
    return { recommendations: [], strategy: 'first_purchase', pitch: 'Omborda mahsulot topilmadi.' };
  }

  const productsText = products.map((p) =>
    `ID: ${p.id} | ${p.name} | ${p.category || '—'} | ${p.price} UZS | Qoldiq: ${p.stock} ${p.unit}`
  ).join('\n');

  const dealsText = pastDeals.length
    ? pastDeals.map((d) => `${d.title} — ${d.amount} UZS (${d.status})`).join('\n')
    : 'Oldingi bitim yo\'q';

  const prompt = `
MIJOZ MA'LUMOTLARI:
Ism: ${contact?.first_name || ''} ${contact?.last_name || ''}
Manbai: ${contact?.source || '—'}
Teglar: ${contact?.tags?.join(', ') || '—'}
Jami bitimlar: ${contact?.total_deals || 0} | Umumiy daromad: ${contact?.total_revenue || 0} UZS

OLDINGI BITIMLAR:
${dealsText}

${conversationText ? `SUHBAT MATNI:\n${conversationText.slice(0, 1000)}` : ''}

MAVJUD MAHSULOTLAR:
${productsText}

Ushbu mijozga qaysi mahsulotlar eng mos keladi?`;

  return aguAI.smart(SYSTEM, prompt, 800, true);
}

module.exports = { recommendProducts };
