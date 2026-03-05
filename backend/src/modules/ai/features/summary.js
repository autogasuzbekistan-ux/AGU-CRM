/**
 * AGU AI — Conversation Summary (Suhbat qisqartmasi)
 * Uzun suhbatni operator uchun strukturali qisqartmaga aylantiradi
 */
const aguAI = require('../ai.service');

const SYSTEM = `Siz CRM suhbatlarini qisqartiruvchi AI siz.
Operator almashinishi yoki shartnoma tuzish uchun suhbatni strukturali formatga o'tkazing.

Javobni FAQAT quyidagi JSON formatida bering:
{
  "title": "Suhbat mavzusi (1 qator)",
  "duration_messages": 25,
  "key_points": [
    "Asosiy nuqta 1",
    "Asosiy nuqta 2",
    "Asosiy nuqta 3"
  ],
  "client_needs": "Mijoz nima xohlaydi",
  "client_concerns": "Mijozning qayg'ular yoki savollari",
  "commitments_made": "Operator nima va'da berdi",
  "next_action": "Keyingi qadam nima bo'lishi kerak",
  "deal_potential": "high",
  "suggested_tags": ["tag1", "tag2"],
  "summary_text": "Umumiy qisqartma (3-5 gap)"
}
deal_potential: high | medium | low | none`;

/**
 * Suhbatni qisqartirish
 * @param {Array} messages - Xabarlar ro'yxati
 * @param {Object} contact - Mijoz ma'lumotlari
 */
async function summarizeConversation(messages, contact = {}) {
  if (!messages || messages.length < 3) {
    return { summary_text: 'Suhbat juda qisqa, qisqartirish kerak emas.', key_points: [] };
  }

  const conversation = messages.map((m) => {
    const role = m.sender_type === 'contact'
      ? `[Mijoz ${contact.first_name || ''}]`
      : `[Operator]`;
    const time = m.sent_at ? new Date(m.sent_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : '';
    return `${time} ${role}: ${m.content}`;
  }).join('\n');

  const prompt = `
Mijoz: ${contact.first_name || ''} ${contact.last_name || ''} | Tel: ${contact.phone || '—'}
Suhbat boshlanishi: ${messages[0]?.sent_at ? new Date(messages[0].sent_at).toLocaleDateString('uz-UZ') : '—'}
Jami xabarlar: ${messages.length}

SUHBAT:
${conversation.slice(0, 8000)}

Iltimos, bu suhbatni qisqartiring.`;

  return aguAI.smart(SYSTEM, prompt, 1024, true);
}

module.exports = { summarizeConversation };
