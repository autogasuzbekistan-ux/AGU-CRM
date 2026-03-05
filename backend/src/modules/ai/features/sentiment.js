/**
 * AGU AI — Sentiment Analysis (His-tuyg'u tahlili)
 * Mijoz xabarining kayfiyatini aniqlaydi va salbiy bo'lsa ogohlantiradi
 */
const aguAI = require('../ai.service');

const SYSTEM = `Siz mijoz xabarlarining his-tuyg'usini tahlil qiluvchi AI siz.
Berilgan xabarni O'zbek/Rus/Ingliz tilida tahlil qiling.

Javobni FAQAT quyidagi JSON formatida bering:
{
  "sentiment": "positive",
  "score": 0.8,
  "emotions": ["xursand", "qiziqish"],
  "intent": "purchase",
  "alert": false,
  "alert_reason": null,
  "summary": "Mijoz mahsulot haqida ijobiy fikr bildirmoqda"
}

sentiment: positive | negative | neutral | mixed
score: -1.0 (juda salbiy) dan 1.0 (juda ijobiy) gacha
intent: purchase | complaint | inquiry | greeting | goodbye | anger | other
alert: true — operator darhol e'tibor berishi kerak (g'azab, shikoyat, hayajon)`;

/**
 * Xabar his-tuyg'usini tahlil qilish
 * @param {string} text - Xabar matni
 * @param {string} language - Til (uz/ru/en/auto)
 */
async function analyzeSentiment(text, language = 'auto') {
  if (!text || text.trim().length < 3) {
    return { sentiment: 'neutral', score: 0, emotions: [], intent: 'other', alert: false };
  }

  const prompt = `Quyidagi mijoz xabarini tahlil qiling:\n"${text.slice(0, 500)}"`;
  return aguAI.fast(SYSTEM, prompt, 300, true);
}

/**
 * Suhbatning umumiy his-tuyg'u tendentsiyasini tahlil qilish
 * @param {Array} messages - Xabarlar ro'yxati
 */
async function analyzeTrend(messages) {
  const contactMessages = messages
    .filter((m) => m.sender_type === 'contact')
    .slice(-15)
    .map((m) => m.content)
    .join('\n');

  if (!contactMessages.trim()) return null;

  const prompt = `Quyidagi mijoz suhbati tendentsiyasini tahlil qiling:\n${contactMessages}`;

  const TREND_SYSTEM = `Suhbat his-tuyg'u o'zgarishini tahlil qiling.
Javobni FAQAT JSON formatida bering:
{
  "trend": "improving",
  "start_sentiment": "negative",
  "end_sentiment": "positive",
  "risk_level": "low",
  "recommendation": "Operator uchun maslahat"
}
trend: improving | declining | stable | volatile
risk_level: critical | high | medium | low`;

  return aguAI.fast(TREND_SYSTEM, prompt, 300, true);
}

module.exports = { analyzeSentiment, analyzeTrend };
