// Kanalga xabar yuborish uchun yagona servis
const axios = require('axios');
const db = require('../../database/connection');
const logger = require('../../config/logger');

/**
 * Suhbat kanaliga xabar yuborish
 * @param {string} conversationId
 * @param {string} content
 * @param {string} type
 */
async function sendMessage(conversationId, content, type = 'text') {
  const conversation = await db('conversations').where({ id: conversationId }).first();
  if (!conversation) throw new Error('Suhbat topilmadi');

  const integration = await db('integrations')
    .where({ organization_id: conversation.organization_id, type: conversation.channel, status: 'active' })
    .first();

  if (!integration) {
    logger.warn(`${conversation.channel} uchun faol integratsiya topilmadi`);
    return;
  }

  switch (conversation.channel) {
    case 'telegram':
      return sendTelegramMessage(conversation, content, integration.credentials.bot_token);
    case 'whatsapp':
      return sendWhatsAppMessage(conversation, content, integration.credentials);
    case 'facebook':
    case 'instagram':
      return sendMetaMessage(conversation, content, integration.credentials.access_token);
    default:
      logger.warn(`Noma'lum kanal: ${conversation.channel}`);
  }
}

async function sendTelegramMessage(conversation, content, botToken) {
  await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    chat_id: conversation.channel_conversation_id,
    text: content,
    parse_mode: 'HTML',
  });
}

async function sendWhatsAppMessage(conversation, content, credentials) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${credentials.phone_number_id}/messages`,
    {
      messaging_product: 'whatsapp',
      to: conversation.channel_conversation_id,
      type: 'text',
      text: { body: content },
    },
    { headers: { Authorization: `Bearer ${credentials.access_token}` } }
  );
}

async function sendMetaMessage(conversation, content, accessToken) {
  await axios.post(
    'https://graph.facebook.com/v18.0/me/messages',
    {
      recipient: { id: conversation.channel_conversation_id },
      message: { text: content },
    },
    { params: { access_token: accessToken } }
  );
}

module.exports = { sendMessage };
