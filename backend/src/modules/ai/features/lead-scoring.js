/**
 * AGU AI — Lead Scoring
 * Leadni 0-100 ball bilan baholash va konvertatsiya ehtimolini aniqlash
 */
const aguAI = require('../ai.service');

const SYSTEM = `Siz AGU CRM uchun Lead Scoring mutaxassisisiz.
Berilgan lead ma'lumotlariga asosan 0-100 ball bering va tahlil qiling.

Baholash mezonlari:
- Mijozning manbasi (Telegram/WA/IG/FB/website) — 0-20 ball
- Suhbat faolligi (xabarlar soni, javob tezligi) — 0-20 ball
- Byudjet mavjudligi — 0-20 ball
- Ehtiyoj aniqlik darajasi — 0-20 ball
- Demografik ma'lumotlar to'liqligi — 0-20 ball

Javobni FAQAT quyidagi JSON formatida bering:
{
  "score": 85,
  "grade": "A",
  "probability": 0.78,
  "strengths": ["kuchli tomonlar ro'yxati"],
  "weaknesses": ["zaif tomonlar ro'yxati"],
  "recommendation": "operator uchun qisqa maslahat (1-2 gap)",
  "priority": "high"
}

grade: A (80-100), B (60-79), C (40-59), D (0-39)
priority: urgent | high | medium | low`;

/**
 * Lead uchun AI ball hisoblash
 * @param {Object} leadData - Lead ma'lumotlari
 * @param {Array} messages - Suhbat xabarlari (ixtiyoriy)
 */
async function scoreLead(leadData, messages = []) {
  const conversationSample = messages.slice(-10).map((m) =>
    `[${m.sender_type === 'contact' ? 'Mijoz' : 'Operator'}]: ${m.content}`
  ).join('\n');

  const prompt = `
Lead ma'lumotlari:
- Sarlavha: ${leadData.title || '—'}
- Manba: ${leadData.source || '—'}
- Status: ${leadData.status || '—'}
- Ustuvorlik: ${leadData.priority || '—'}
- Byudjet: ${leadData.budget ? leadData.budget + ' UZS' : 'Noma\'lum'}
- Yaratilgan: ${leadData.created_at ? new Date(leadData.created_at).toLocaleDateString('uz-UZ') : '—'}
- Tavsif: ${leadData.description || '—'}
- Teglar: ${leadData.tags?.join(', ') || '—'}

${conversationSample ? `So'nggi suhbat:\n${conversationSample}` : 'Suhbat mavjud emas.'}

Iltimos, bu leadni baholang.`;

  return aguAI.smart(SYSTEM, prompt, 512, true);
}

module.exports = { scoreLead };
