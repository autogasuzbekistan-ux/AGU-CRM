const db = require('../../../database/connection');
const logger = require('../../../config/logger');

// WhatsApp webhook tekshirish (Meta talab qiladi)
exports.verify = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    logger.info('WhatsApp webhook tasdiqlandi');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

exports.handle = async (req, res) => {
  try {
    res.sendStatus(200);

    const body = req.body;

    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const messages = value.messages || [];
        const contacts = value.contacts || [];

        for (const message of messages) {
          await processWhatsAppMessage(message, contacts, value.metadata);
        }
      }
    }
  } catch (error) {
    logger.error('WhatsApp webhook xatosi:', error);
  }
};

async function processWhatsAppMessage(message, waContacts, metadata) {
  const phoneNumber = message.from; // Format: 998901234567
  const waContact = waContacts.find((c) => c.wa_id === phoneNumber);

  // Tashkilotni topish (phone_number_id bo'yicha)
  const integration = await db('integrations')
    .where({ type: 'whatsapp', status: 'active' })
    .whereRaw("credentials->>'phone_number_id' = ?", [metadata.phone_number_id])
    .first();

  if (!integration) {
    logger.warn(`WhatsApp integratsiyasi topilmadi: ${metadata.phone_number_id}`);
    return;
  }

  const orgId = integration.organization_id;

  // Kontaktni topish yoki yaratish
  let contact = await db('contacts')
    .where({ organization_id: orgId })
    .where(function () {
      this.where({ whatsapp_phone: phoneNumber }).orWhere({ phone: `+${phoneNumber}` });
    })
    .first();

  if (!contact) {
    const nameParts = (waContact?.profile?.name || '').split(' ');
    const [newContact] = await db('contacts').insert({
      organization_id: orgId,
      first_name: nameParts[0] || '',
      last_name: nameParts.slice(1).join(' ') || '',
      phone: `+${phoneNumber}`,
      whatsapp_phone: phoneNumber,
      source: 'whatsapp',
    }).returning('*');

    contact = newContact;

    // Lead yaratish
    const operatorId = await autoAssignOperator(orgId);
    await db('leads').insert({
      organization_id: orgId,
      contact_id: contact.id,
      assigned_to: operatorId,
      title: `WhatsApp: ${waContact?.profile?.name || phoneNumber}`,
      source: 'whatsapp',
      source_id: message.id,
      status: 'new',
    });
  }

  // Suhbat
  let conversation = await db('conversations')
    .where({ organization_id: orgId, channel: 'whatsapp', channel_conversation_id: phoneNumber })
    .first();

  if (!conversation) {
    const [newConv] = await db('conversations').insert({
      organization_id: orgId,
      contact_id: contact.id,
      channel: 'whatsapp',
      channel_conversation_id: phoneNumber,
    }).returning('*');
    conversation = newConv;
  }

  // Xabar turini aniqlash
  let type = 'text';
  let content = '';
  let mediaUrl = null;

  switch (message.type) {
    case 'text':
      content = message.text?.body || '';
      break;
    case 'image':
      type = 'image';
      content = message.image?.caption || '';
      break;
    case 'audio':
    case 'voice':
      type = 'audio';
      break;
    case 'video':
      type = 'video';
      content = message.video?.caption || '';
      break;
    case 'document':
      type = 'file';
      content = message.document?.filename || '';
      break;
    case 'location':
      type = 'location';
      content = JSON.stringify(message.location);
      break;
    case 'interactive':
      content = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '';
      break;
  }

  await db('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'contact',
    sender_id: contact.id,
    external_id: message.id,
    type,
    content,
    media_url: mediaUrl,
    sent_at: new Date(parseInt(message.timestamp) * 1000),
    metadata: { wa_id: phoneNumber },
  });

  await db('conversations')
    .where({ id: conversation.id })
    .update({ last_message_at: new Date(), unread_count: db.raw('unread_count + 1') });

  logger.info(`WhatsApp xabar saqlandi: ${phoneNumber}`);
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
