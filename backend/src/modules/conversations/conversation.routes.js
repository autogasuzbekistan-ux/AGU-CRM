const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const db = require('../../database/connection');
const axios = require('axios');
const logger = require('../../config/logger');

router.use(authenticate);

// Barcha suhbatlar
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, channel, status, assignedTo, unread } = req.query;
    const offset = (page - 1) * limit;

    let query = db('conversations as conv')
      .leftJoin('contacts as c', 'conv.contact_id', 'c.id')
      .leftJoin('users as u', 'conv.assigned_to', 'u.id')
      .where({ 'conv.organization_id': req.organizationId })
      .select(
        'conv.*',
        db.raw("CONCAT(c.first_name, ' ', c.last_name) as contact_name"),
        'c.phone as contact_phone',
        'c.avatar_url as contact_avatar',
        db.raw("CONCAT(u.first_name, ' ', u.last_name) as operator_name")
      )
      .orderBy('conv.last_message_at', 'desc');

    if (req.user.role === 'operator') query = query.where({ 'conv.assigned_to': req.user.id });
    if (channel) query = query.where({ 'conv.channel': channel });
    if (status) query = query.where({ 'conv.status': status });
    if (assignedTo) query = query.where({ 'conv.assigned_to': assignedTo });
    if (unread === 'true') query = query.where('conv.unread_count', '>', 0);

    const [{ count }] = await query.clone().count('conv.id as count');
    const conversations = await query.offset(offset).limit(parseInt(limit));

    // Oxirgi xabarni qo'shish
    for (const conv of conversations) {
      conv.last_message = await db('messages')
        .where({ conversation_id: conv.id })
        .orderBy('sent_at', 'desc')
        .first();
    }

    res.json({ success: true, data: conversations, meta: { total: parseInt(count), page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    next(error);
  }
});

// Suhbat xabarlari
router.get('/:id/messages', async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const messages = await db('messages')
      .where({ conversation_id: req.params.id })
      .orderBy('sent_at', 'desc')
      .offset(offset)
      .limit(parseInt(limit));

    // O'qildi deb belgilash
    await db('conversations')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update({ unread_count: 0 });

    await db('messages')
      .where({ conversation_id: req.params.id, is_read: false })
      .update({ is_read: true });

    res.json({ success: true, data: messages.reverse() });
  } catch (error) {
    next(error);
  }
});

// Xabar yuborish
router.post('/:id/messages', async (req, res, next) => {
  try {
    const { content, type = 'text' } = req.body;

    const conversation = await db('conversations')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Suhbat topilmadi' });
    }

    // Xabarni bazaga saqlash
    const [message] = await db('messages').insert({
      conversation_id: conversation.id,
      sender_type: 'operator',
      sender_id: req.user.id,
      type,
      content,
      is_read: true,
    }).returning('*');

    // Kanalga xabar yuborish
    await sendMessageToChannel(conversation, content, type);

    // Suhbatni yangilash
    await db('conversations')
      .where({ id: conversation.id })
      .update({ last_message_at: new Date() });

    // Operator statistikasi
    const today = new Date().toISOString().split('T')[0];
    await db('operator_stats')
      .insert({
        user_id: req.user.id,
        organization_id: req.organizationId,
        period_type: 'daily',
        period_date: today,
        messages_sent: 1,
      })
      .onConflict(['user_id', 'period_type', 'period_date'])
      .merge({ messages_sent: db.raw('operator_stats.messages_sent + 1') });

    // Real-time
    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${conversation.id}`).emit('new_message', { message });
    }

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
});

// Suhbatni yopish/tayinlash
router.patch('/:id/assign', async (req, res, next) => {
  try {
    const { userId } = req.body;
    await db('conversations')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update({ assigned_to: userId });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/resolve', async (req, res, next) => {
  try {
    await db('conversations')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update({ status: 'resolved' });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Kanalga xabar yuborish
async function sendMessageToChannel(conversation, content, type) {
  try {
    const integration = await db('integrations')
      .where({ organization_id: conversation.organization_id, type: conversation.channel, status: 'active' })
      .first();

    if (!integration) return;

    switch (conversation.channel) {
      case 'telegram': {
        const botToken = integration.credentials.bot_token;
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          chat_id: conversation.channel_conversation_id,
          text: content,
          parse_mode: 'HTML',
        });
        break;
      }
      case 'whatsapp': {
        const { access_token, phone_number_id } = integration.credentials;
        await axios.post(
          `https://graph.facebook.com/v18.0/${phone_number_id}/messages`,
          {
            messaging_product: 'whatsapp',
            to: conversation.channel_conversation_id,
            type: 'text',
            text: { body: content },
          },
          { headers: { Authorization: `Bearer ${access_token}` } }
        );
        break;
      }
      case 'facebook':
      case 'instagram': {
        const { access_token } = integration.credentials;
        await axios.post(
          `https://graph.facebook.com/v18.0/me/messages`,
          {
            recipient: { id: conversation.channel_conversation_id },
            message: { text: content },
          },
          { params: { access_token } }
        );
        break;
      }
    }
  } catch (error) {
    logger.error(`Xabar yuborishda xato (${conversation.channel}):`, error.message);
  }
}

module.exports = router;
