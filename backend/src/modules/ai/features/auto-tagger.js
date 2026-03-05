/**
 * AGU AI — Auto Tagger (Avtomatik Teg)
 * Suhbat va kontakt ma'lumotlaridan teglar va kategoriyalar aniqlaydi
 */
const aguAI = require('../ai.service');

const SYSTEM = `Siz CRM kontaktlarini kategoriyalovchi AI siz.
Berilgan ma'lumotlardan mos teglar va kategoriya aniqlang.

Teglar uchun misol: ["premium", "qayta-aloqa", "katta-summa", "vip", "raqobatchi-bor",
"narx-hissiyotli", "tez-qaror", "texnik-savollar", "korporativ", "chakana"]

Javobni FAQAT quyidagi JSON formatida bering:
{
  "tags": ["teg1", "teg2", "teg3"],
  "category": "Korporativ Mijoz",
  "segment": "premium",
  "industry": "IT",
  "interests": ["mahsulot A", "mahsulot B"],
  "risk_level": "low",
  "lifecycle_stage": "consideration",
  "notes": "Operator uchun qisqa izoh (1 gap)"
}

segment: premium | standard | economy | vip | new
lifecycle_stage: awareness | interest | consideration | intent | purchase | retention | advocacy
risk_level: high | medium | low (churn ehtimoli)
industry: IT | Savdo | Ishlab chiqarish | Tibbiyot | Ta\'lim | Qurilish | Oziq-ovqat | Boshqa`;

/**
 * Kontakt uchun avtomatik teg va kategoriya aniqlash
 * @param {Object} contact - Kontakt ma'lumotlari
 * @param {Array} messages - Suhbat xabarlari
 * @param {Array} deals - Bitimlar tarixi
 */
async function autoTagContact(contact, messages = [], deals = []) {
  const conversationSample = messages
    .filter((m) => m.sender_type === 'contact')
    .slice(-10)
    .map((m) => m.content)
    .join(' | ');

  const dealsText = deals.length
    ? deals.map((d) => `${d.title}: ${d.amount} UZS (${d.status})`).join(', ')
    : 'Hali bitim yo\'q';

  const prompt = `
KONTAKT MA'LUMOTLARI:
Ism: ${contact.first_name || ''} ${contact.last_name || ''}
Kompaniya: ${contact.company_name || '—'}
Manba: ${contact.source || '—'}
Shahar: ${contact.city || '—'}
Til: ${contact.language || '—'}
Mavjud teglar: ${contact.tags?.join(', ') || '—'}

BITIMLAR: ${dealsText}

SUHBAT NAMUNASI: ${conversationSample || 'Suhbat mavjud emas'}

Ushbu kontaktga mos teglar va kategoriya aniqlang.`;

  return aguAI.fast(SYSTEM, prompt, 400, true);
}

/**
 * Lead uchun avtomatik teg aniqlash
 * @param {Object} lead - Lead ma'lumotlari
 * @param {string} conversationText - Suhbat matni
 */
async function autoTagLead(lead, conversationText = '') {
  const prompt = `
LEAD MA'LUMOTLARI:
Sarlavha: ${lead.title}
Tavsif: ${lead.description || '—'}
Manba: ${lead.source || '—'}
Ustuvorlik: ${lead.priority || '—'}
Byudjet: ${lead.budget || 'Noma\'lum'}

${conversationText ? `SUHBAT: ${conversationText.slice(0, 500)}` : ''}

Ushbu lead uchun teglar aniqlang.`;

  return aguAI.fast(SYSTEM, prompt, 300, true);
}

module.exports = { autoTagContact, autoTagLead };
