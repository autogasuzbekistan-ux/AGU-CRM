/**
 * AGU AI — Chatbot Auto-Reply (Avtomatik javob)
 * Operator band bo'lganda yoki tunda tez-tez savollarga AI javob beradi
 */
const aguAI = require('../ai.service');
const db = require('../../../database/connection');

/**
 * Tashkilot uchun chatbot tizim promptini qurish
 */
async function buildSystemPrompt(organizationId) {
  const org = await db('organizations').where({ id: organizationId }).first();

  return `Siz "${org?.name || 'AGU CRM'}" kompaniyasining AI yordamchisisiz, nomi AGU AI.
Mijozlarga ${org?.name || 'kompaniya'} haqida ma'lumot bering va ularning savollariga javob bering.

MUHIM QOIDALAR:
1. Faqat berilgan ma'lumotlar asosida javob bering
2. Bilmagan narsalar haqida "Operator tez orada aloqaga chiqadi" deymiz
3. O'zbek, Rus yoki Ingliz tilida javob bering (mijoz tilini aniqlang)
4. Qisqa va aniq javob bering (maksimal 3 gap)
5. Doim samimiy va professional bo'ling
6. Narx yoki shartnoma haqida so'rab qolsa, operatorga yo'naltiring

KOMPANIYA MA'LUMOTLARI:
Nomi: ${org?.name || '—'}
Manzil: ${org?.city || 'Toshkent'}, O'zbekiston
Valyuta: ${org?.currency || 'UZS'}

Javob oxirida FAQAT JSON formatida qo'shing:
{"should_escalate": false, "escalate_reason": null, "detected_intent": "inquiry"}
should_escalate: true — bu savolni operator ko'rishi kerak (shikoyat, narx, shartnoma)`;
}

/**
 * Chatbot javob berish
 * @param {string} organizationId - Tashkilot ID
 * @param {string} userMessage - Mijoz xabari
 * @param {Array} history - So'nggi suhbat tarixi
 * @param {Object} contactInfo - Mijoz ma'lumotlari
 */
async function autoReply(organizationId, userMessage, history = [], contactInfo = {}) {
  const systemPrompt = await buildSystemPrompt(organizationId);

  const conversationHistory = history.slice(-6).map((m) => {
    const role = m.sender_type === 'contact' ? 'Mijoz' : 'AGU AI';
    return `${role}: ${m.content}`;
  }).join('\n');

  const prompt = `${conversationHistory ? `Suhbat tarixi:\n${conversationHistory}\n\n` : ''}Mijoz: ${userMessage}

Javob bering va JSON meta ma'lumotni qo'shing.`;

  const rawResponse = await aguAI.fast(systemPrompt, prompt, 400);

  // JSON meta qismni ajratish
  const jsonMatch = rawResponse.match(/\{[^}]*"should_escalate"[^}]*\}/);
  let meta = { should_escalate: false, escalate_reason: null, detected_intent: 'inquiry' };

  if (jsonMatch) {
    try { meta = JSON.parse(jsonMatch[0]); } catch {}
  }

  // JSON qismni matndan olib tashlash
  const cleanText = rawResponse.replace(/\{[^}]*"should_escalate"[^}]*\}/, '').trim();

  return {
    text: cleanText,
    should_escalate: meta.should_escalate || false,
    escalate_reason: meta.escalate_reason,
    detected_intent: meta.detected_intent || 'inquiry',
    is_bot: true,
  };
}

/**
 * Tashkilotning FAQ ma'lumotlarini yangilash (keyingi etap uchun)
 */
async function updateFAQ(organizationId, faqs) {
  // Bu funksiya keyingi etapda: Redis da FAQ saqlash
  return { updated: true };
}

module.exports = { autoReply, updateFAQ };
