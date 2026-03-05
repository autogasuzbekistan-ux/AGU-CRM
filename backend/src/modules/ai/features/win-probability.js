/**
 * AGU AI — Deal Win Probability (Bitim yutilish ehtimoli)
 * Bitimning real vaqtda yutilish ehtimolini AI orqali hisoblaydi
 */
const aguAI = require('../ai.service');
const db = require('../../../database/connection');

const SYSTEM = `Siz CRM bitimlar tahlilchisisiz.
Berilgan bitim ma'lumotlariga asosan yutilish ehtimolini hisoblang.

Omillar:
1. Bitim muddati (muddat o'tgan = past ehtimol)
2. Suhbat faolligi (oxirgi aloqa qachon bo'lgani)
3. Bitim summasi (katta summa = past ehtimol, agar yangi mijoz bo'lsa)
4. Bosqich tarixi (tez o'tish = yuqori ehtimol)
5. Mijoz tarixiy konvertatsiya darajasi
6. Suhbat kayfiyati

Javobni FAQAT quyidagi JSON formatida bering:
{
  "probability": 0.74,
  "confidence": 0.85,
  "grade": "B+",
  "risk_factors": ["Oxirgi aloqa 5 kun oldin", "Muddat yaqin"],
  "positive_factors": ["Mijoz narxga rozi", "Faol suhbat"],
  "stage_recommendation": "Taklifni tuzing va yuboring",
  "estimated_close_days": 7,
  "action_required": true,
  "action": "Bugun qayta aloqa qiling va narx taklifi yuboring"
}

probability: 0-1 orasida
confidence: modelning ishonch darajasi
grade: A+ dan F gacha`;

/**
 * Bitim uchun yutilish ehtimolini hisoblash
 */
async function calculateWinProbability(dealId) {
  const deal = await db('deals as d')
    .leftJoin('contacts as c', 'd.contact_id', 'c.id')
    .leftJoin('pipeline_stages as ps', 'd.stage_id', 'ps.id')
    .leftJoin('users as u', 'd.assigned_to', 'u.id')
    .where({ 'd.id': dealId })
    .select(
      'd.*',
      'ps.name as stage_name', 'ps.probability as stage_probability',
      'ps.is_won', 'ps.is_lost', 'ps.sort_order',
      db.raw("CONCAT(c.first_name, ' ', c.last_name) as contact_name"),
      'c.total_deals as contact_total_deals',
      'c.total_revenue as contact_total_revenue',
      'c.source as contact_source',
      db.raw("CONCAT(u.first_name, ' ', u.last_name) as operator_name")
    )
    .first();

  if (!deal) throw new Error('Bitim topilmadi');

  if (deal.is_won) return { probability: 1.0, grade: 'A+', stage_recommendation: 'Bitim yutildi!' };
  if (deal.is_lost) return { probability: 0.0, grade: 'F', stage_recommendation: 'Bitim yo\'qotildi.' };

  // Suhbat ma'lumotlari
  const lastConversation = await db('conversations')
    .where({ contact_id: deal.contact_id, organization_id: deal.organization_id })
    .orderBy('last_message_at', 'desc')
    .first();

  const daysSinceContact = lastConversation?.last_message_at
    ? Math.floor((Date.now() - new Date(lastConversation.last_message_at)) / 86400000)
    : 999;

  const daysInDeal = Math.floor((Date.now() - new Date(deal.created_at)) / 86400000);
  const daysUntilClose = deal.expected_close_date
    ? Math.floor((new Date(deal.expected_close_date) - Date.now()) / 86400000)
    : null;

  // O'xshash yutilgan bitimlarni topish
  const similarWon = await db('deals')
    .where({
      organization_id: deal.organization_id,
      status: 'won',
      assigned_to: deal.assigned_to,
    })
    .whereBetween('amount', [deal.amount * 0.5, deal.amount * 2])
    .count('* as count')
    .first();

  const prompt = `
BITIM MA'LUMOTLARI:
Sarlavha: ${deal.title}
Summa: ${deal.amount} UZS
Bosqich: ${deal.stage_name} (ehtimol: ${deal.stage_probability}%)
Pipeline pozitsiyasi: ${deal.sort_order}

VAQT TAHLILI:
Bitim yaratilgan: ${daysInDeal} kun oldin
Oxirgi aloqa: ${daysSinceContact === 999 ? 'Hech qachon bo\'lmagan' : `${daysSinceContact} kun oldin`}
Muddat: ${daysUntilClose !== null ? (daysUntilClose < 0 ? `${Math.abs(daysUntilClose)} kun kechikkan!` : `${daysUntilClose} kun qoldi`) : 'Belgilanmagan'}

MIJOZ TARIXI:
Ism: ${deal.contact_name}
Oldingi bitimlar: ${deal.contact_total_deals || 0}
Umumiy daromad: ${deal.contact_total_revenue || 0} UZS
Manba: ${deal.contact_source || '—'}

OPERATOR:
${deal.operator_name} — o'xshash bitimlardan ${similarWon?.count || 0} ta yutgan

Bitimning yutilish ehtimolini hisoblang.`;

  return aguAI.smart(SYSTEM, prompt, 600, true);
}

module.exports = { calculateWinProbability };
