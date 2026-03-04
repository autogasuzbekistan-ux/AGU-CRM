const db = require('../../../database/connection');
const logger = require('../../../config/logger');
const messageService = require('../message.service');

exports.handle = async (req, res) => {
  try {
    // Darhol 200 qaytarish (Telegram talab qiladi)
    res.sendStatus(200);

    const { token } = req.params;
    const update = req.body;

    // Bot tokenini tekshirish va integratsiyani topish
    const integration = await db('integrations')
      .where({ type: 'telegram', status: 'active' })
      .whereRaw("credentials->>'bot_token' = ?", [token])
      .first();

    if (!integration) {
      logger.warn(`Noma'lum Telegram bot token: ${token}`);
      return;
    }

    // Xabarni qayta ishlash
    if (update.message) {
      await handleMessage(update.message, integration);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, integration);
    } else if (update.my_chat_member) {
      // Bot guruhga qo'shildi/chiqarildi
      logger.info('Telegram chat member yangilandi', update.my_chat_member);
    }
  } catch (error) {
    logger.error('Telegram webhook xatosi:', error);
  }
};

async function handleMessage(message, integration) {
  const chatId = message.chat.id;
  const telegramUserId = message.from.id;
  const orgId = integration.organization_id;

  // Kontaktni topish yoki yaratish
  let contact = await db('contacts')
    .where({ organization_id: orgId, telegram_id: telegramUserId })
    .first();

  if (!contact) {
    // Yangi kontakt yaratish
    const [newContact] = await db('contacts').insert({
      organization_id: orgId,
      first_name: message.from.first_name || '',
      last_name: message.from.last_name || '',
      telegram_id: telegramUserId,
      telegram_username: message.from.username,
      source: 'telegram',
      language: message.from.language_code === 'uz' ? 'uz' : (message.from.language_code === 'ru' ? 'ru' : 'uz'),
    }).returning('*');

    contact = newContact;

    // Yangi lead yaratish va tayinlash
    const operatorId = await autoAssignOperator(orgId);
    await db('leads').insert({
      organization_id: orgId,
      contact_id: contact.id,
      assigned_to: operatorId,
      title: `Telegram: ${message.from.first_name} ${message.from.last_name || ''}`,
      source: 'telegram',
      source_id: String(chatId),
      status: 'new',
    });

    logger.info(`Yangi Telegram kontakt yaratildi: ${contact.id}`);
  }

  // Suhbatni topish yoki yaratish
  let conversation = await db('conversations')
    .where({
      organization_id: orgId,
      channel: 'telegram',
      channel_conversation_id: String(chatId),
    })
    .first();

  if (!conversation) {
    const [newConv] = await db('conversations').insert({
      organization_id: orgId,
      contact_id: contact.id,
      channel: 'telegram',
      channel_conversation_id: String(chatId),
      status: 'open',
    }).returning('*');
    conversation = newConv;
  }

  // Xabarni saqlash
  const messageData = {
    conversation_id: conversation.id,
    sender_type: 'contact',
    sender_id: contact.id,
    external_id: String(message.message_id),
    type: getMessageType(message),
    content: message.text || message.caption || '',
    sent_at: new Date(message.date * 1000),
  };

  if (message.photo) {
    messageData.media_url = await getTelegramFileUrl(message.photo.slice(-1)[0].file_id, integration.credentials.bot_token);
    messageData.media_type = 'image/jpeg';
  } else if (message.document) {
    messageData.media_url = await getTelegramFileUrl(message.document.file_id, integration.credentials.bot_token);
    messageData.media_type = message.document.mime_type;
  }

  await db('messages').insert(messageData);

  // Suhbatni yangilash
  await db('conversations')
    .where({ id: conversation.id })
    .update({
      last_message_at: new Date(),
      unread_count: db.raw('unread_count + 1'),
    });

  // Real-time bildirishnoma
  const { io } = require('../../../index'); // Circular dependency oldini olish uchun
  // Socket orqali operator ga bildirishnoma

  logger.info(`Telegram xabar saqlandi: conv=${conversation.id}`);
}

async function handleCallbackQuery(callbackQuery, integration) {
  // Inline keyboard tugmalarini qayta ishlash
  logger.info('Telegram callback query:', callbackQuery.data);
}

function getMessageType(message) {
  if (message.photo) return 'image';
  if (message.video) return 'video';
  if (message.audio) return 'audio';
  if (message.voice) return 'audio';
  if (message.document) return 'file';
  if (message.sticker) return 'sticker';
  if (message.location) return 'location';
  return 'text';
}

async function getTelegramFileUrl(fileId, botToken) {
  try {
    const axios = require('axios');
    const response = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const filePath = response.data.result.file_path;
    return `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  } catch {
    return null;
  }
}

async function autoAssignOperator(organizationId) {
  const today = new Date().toISOString().split('T')[0];
  const operator = await db('users')
    .leftJoin('operator_stats as os', function () {
      this.on('users.id', 'os.user_id')
        .andOn('os.period_type', db.raw("'daily'"))
        .andOn('os.period_date', db.raw("?", [today]));
    })
    .where({ 'users.organization_id': organizationId, 'users.role': 'operator', 'users.is_active': true })
    .select('users.id', db.raw('COALESCE(os.leads_received, 0) as leads_count'))
    .orderBy('leads_count', 'asc')
    .first();

  return operator?.id;
}
