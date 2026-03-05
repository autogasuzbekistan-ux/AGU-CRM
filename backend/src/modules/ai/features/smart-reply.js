/**
 * AGU AI — Smart Reply (Aqlli javob taklifi)
 * Operator yozayotganda suhbat kontekstiga qarab 3 ta taklif beradi
 */
const aguAI = require('../ai.service');

const SYSTEM = `Siz O'zbekistondagi biznes uchun professional mijoz xizmat ko'rsatuvchisisiz.
Suhbat tarixiga qarab operatorga 3 ta tayyor javob taklif qiling.

Qoidalar:
- Javoblar qisqa, aniq va professional bo'lsin
- O'zbek yoki rus tilida yozing (mijoz tilini follow qiling)
- Bitta taklif muammoni hal qilsin, bitta savolga javob bersin, bitta qo'shimcha ma'lumot bersin
- Emoji ishlatishingiz mumkin, lekin ko'p emas
- Har bir javob 1-3 gapdan iborat bo'lsin

Javobni FAQAT quyidagi JSON formatida bering:
{
  "suggestions": [
    {"text": "birinchi javob", "type": "answer"},
    {"text": "ikkinchi javob", "type": "clarify"},
    {"text": "uchinchi javob", "type": "upsell"}
  ]
}

type: answer | clarify | upsell | greeting | closing`;

/**
 * Smart reply taklif qilish
 * @param {Array} messages - So'nggi xabarlar (max 10 ta)
 * @param {string} channel - Kanal (telegram/whatsapp/instagram/facebook)
 * @param {Object} contactInfo - Mijoz ma'lumotlari
 */
async function suggestReplies(messages, channel = 'telegram', contactInfo = {}) {
  const conversation = messages.slice(-8).map((m) => {
    const role = m.sender_type === 'contact' ? `Mijoz (${contactInfo.first_name || 'Noma\'lum'})` : 'Operator';
    return `${role}: ${m.content}`;
  }).join('\n');

  const lastMessage = messages.filter((m) => m.sender_type === 'contact').slice(-1)[0];

  const prompt = `
Kanal: ${channel.toUpperCase()}
Mijoz: ${contactInfo.first_name || ''} ${contactInfo.last_name || ''} | Tel: ${contactInfo.phone || '—'}

Suhbat tarixi:
${conversation || 'Hali suhbat bo\'lmagan. Salom xabari yuboring.'}

Oxirgi mijoz xabari: "${lastMessage?.content || '—'}"

Operatorga 3 ta tayyor javob taklif qiling.`;

  return aguAI.fast(SYSTEM, prompt, 400, true);
}

module.exports = { suggestReplies };
