/**
 * AGU AI — REST API Endpointlari
 * Barcha 8 ta AI funksiyasi uchun endpointlar
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const db = require('../../database/connection');
const logger = require('../../config/logger');
const aguAI = require('./ai.service');

// AI feature modullari
const { scoreLead }             = require('./features/lead-scoring');
const { suggestReplies }        = require('./features/smart-reply');
const { analyzeSentiment, analyzeTrend } = require('./features/sentiment');
const { summarizeConversation } = require('./features/summary');
const { autoReply }             = require('./features/chatbot');
const { recommendProducts }     = require('./features/recommender');
const { calculateWinProbability } = require('./features/win-probability');
const { autoTagContact, autoTagLead } = require('./features/auto-tagger');

router.use(authenticate);

// AI holati tekshirish
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      available: aguAI.isAvailable(),
      name: 'AGU AI',
      version: '1.0',
      features: [
        'lead-scoring', 'smart-reply', 'sentiment',
        'summary', 'chatbot', 'recommender',
        'win-probability', 'auto-tagger',
      ],
    },
  });
});

// ────────────────────────────────────────────
// 1. LEAD SCORING
// ────────────────────────────────────────────
router.post('/leads/:id/score', async (req, res, next) => {
  try {
    const lead = await db('leads')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();

    if (!lead) return res.status(404).json({ success: false, message: 'Lead topilmadi' });

    // Suhbat xabarlarini olish
    const conversation = await db('conversations')
      .where({ contact_id: lead.contact_id, organization_id: req.organizationId })
      .first();

    const messages = conversation
      ? await db('messages').where({ conversation_id: conversation.id }).orderBy('sent_at', 'asc').limit(20)
      : [];

    const result = await scoreLead(lead, messages);

    // Natijani saqlash
    await db('leads')
      .where({ id: lead.id })
      .update({ custom_fields: db.raw("custom_fields || ?::jsonb", [JSON.stringify({ ai_score: result })]) });

    logger.info(`AGU AI Lead Score: lead=${lead.id} score=${result.score}`);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ────────────────────────────────────────────
// 2. SMART REPLY
// ────────────────────────────────────────────
router.get('/conversations/:id/smart-reply', async (req, res, next) => {
  try {
    const conversation = await db('conversations')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();

    if (!conversation) return res.status(404).json({ success: false, message: 'Suhbat topilmadi' });

    const messages = await db('messages')
      .where({ conversation_id: conversation.id })
      .orderBy('sent_at', 'desc')
      .limit(8);

    const contact = conversation.contact_id
      ? await db('contacts').where({ id: conversation.contact_id }).first()
      : {};

    const result = await suggestReplies(
      messages.reverse(),
      conversation.channel,
      contact || {}
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ────────────────────────────────────────────
// 3. SENTIMENT ANALYSIS
// ────────────────────────────────────────────
router.post('/sentiment', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Matn kiritilishi shart' });

    const result = await analyzeSentiment(text);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/conversations/:id/sentiment-trend', async (req, res, next) => {
  try {
    const messages = await db('messages')
      .where({ conversation_id: req.params.id })
      .orderBy('sent_at', 'asc')
      .limit(30);

    const result = await analyzeTrend(messages);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ────────────────────────────────────────────
// 4. CONVERSATION SUMMARY
// ────────────────────────────────────────────
router.get('/conversations/:id/summary', async (req, res, next) => {
  try {
    const conversation = await db('conversations')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();

    if (!conversation) return res.status(404).json({ success: false, message: 'Suhbat topilmadi' });

    const messages = await db('messages')
      .where({ conversation_id: conversation.id })
      .orderBy('sent_at', 'asc')
      .limit(100);

    const contact = conversation.contact_id
      ? await db('contacts').where({ id: conversation.contact_id }).first()
      : {};

    const result = await summarizeConversation(messages, contact || {});

    // Teglarni avtomatik saqlash
    if (result.suggested_tags?.length && conversation.contact_id) {
      const contact = await db('contacts').where({ id: conversation.contact_id }).first();
      if (contact) {
        const existingTags = contact.tags || [];
        const newTags = [...new Set([...existingTags, ...result.suggested_tags])];
        await db('contacts').where({ id: contact.id }).update({ tags: newTags });
      }
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ────────────────────────────────────────────
// 5. CHATBOT AUTO-REPLY
// ────────────────────────────────────────────
router.post('/chatbot/reply', async (req, res, next) => {
  try {
    const { message, conversationId, contactId } = req.body;

    const history = conversationId
      ? await db('messages').where({ conversation_id: conversationId }).orderBy('sent_at', 'desc').limit(6)
      : [];

    const contact = contactId
      ? await db('contacts').where({ id: contactId }).first()
      : {};

    const result = await autoReply(
      req.organizationId,
      message,
      history.reverse(),
      contact || {}
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ────────────────────────────────────────────
// 6. PRODUCT RECOMMENDER
// ────────────────────────────────────────────
router.get('/contacts/:contactId/recommendations', async (req, res, next) => {
  try {
    const { conversationId } = req.query;

    let conversationText = '';
    if (conversationId) {
      const msgs = await db('messages')
        .where({ conversation_id: conversationId })
        .orderBy('sent_at', 'asc')
        .limit(20);
      conversationText = msgs.map((m) => m.content).join(' ');
    }

    const result = await recommendProducts(
      req.params.contactId,
      req.organizationId,
      conversationText
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ────────────────────────────────────────────
// 7. DEAL WIN PROBABILITY
// ────────────────────────────────────────────
router.get('/deals/:id/win-probability', async (req, res, next) => {
  try {
    const deal = await db('deals')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();

    if (!deal) return res.status(404).json({ success: false, message: 'Bitim topilmadi' });

    const result = await calculateWinProbability(req.params.id);

    // Natijani saqlash
    await db('deals')
      .where({ id: deal.id })
      .update({
        probability: Math.round((result.probability || 0) * 100),
        custom_fields: db.raw("custom_fields || ?::jsonb", [JSON.stringify({ ai_win_prob: result })]),
      });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ────────────────────────────────────────────
// 8. AUTO TAGGER
// ────────────────────────────────────────────
router.post('/contacts/:id/auto-tag', async (req, res, next) => {
  try {
    const contact = await db('contacts')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();

    if (!contact) return res.status(404).json({ success: false, message: 'Kontakt topilmadi' });

    const conversations = await db('conversations')
      .where({ contact_id: contact.id, organization_id: req.organizationId })
      .limit(2);

    let messages = [];
    if (conversations.length) {
      messages = await db('messages')
        .whereIn('conversation_id', conversations.map((c) => c.id))
        .orderBy('sent_at', 'desc')
        .limit(20);
    }

    const deals = await db('deals')
      .where({ contact_id: contact.id, organization_id: req.organizationId })
      .limit(5);

    const result = await autoTagContact(contact, messages, deals);

    // Teglarni saqlash
    if (result.tags?.length) {
      const existing = contact.tags || [];
      const merged = [...new Set([...existing, ...result.tags])];
      await db('contacts').where({ id: contact.id }).update({ tags: merged });
    }

    res.json({ success: true, data: result, message: `${result.tags?.length || 0} ta teg qo'shildi` });
  } catch (error) {
    next(error);
  }
});

router.post('/leads/:id/auto-tag', async (req, res, next) => {
  try {
    const lead = await db('leads')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();

    if (!lead) return res.status(404).json({ success: false, message: 'Lead topilmadi' });

    const result = await autoTagLead(lead, lead.description || '');

    if (result.tags?.length) {
      const merged = [...new Set([...(lead.tags || []), ...result.tags])];
      await db('leads').where({ id: lead.id }).update({ tags: merged });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ────────────────────────────────────────────
// BATCH: Barcha leadlarni bir vaqtda baholash
// ────────────────────────────────────────────
router.post('/leads/batch-score', async (req, res, next) => {
  try {
    const leads = await db('leads')
      .where({ organization_id: req.organizationId, status: 'new' })
      .limit(20);

    // Background da ishlash (response darhol qaytariladi)
    res.json({
      success: true,
      message: `${leads.length} ta lead baholanmoqda. Natijalar biroz keyin tayyor bo'ladi.`,
      total: leads.length,
    });

    // Fon rejimida ishlash
    for (const lead of leads) {
      try {
        const result = await scoreLead(lead, []);
        await db('leads')
          .where({ id: lead.id })
          .update({ custom_fields: db.raw("custom_fields || ?::jsonb", [JSON.stringify({ ai_score: result })]) });
      } catch (err) {
        logger.error(`Batch score xatosi lead=${lead.id}:`, err.message);
      }
      // Rate limit uchun kutish
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
