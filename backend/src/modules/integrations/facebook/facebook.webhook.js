const db = require('../../../database/connection');
const logger = require('../../../config/logger');

exports.verify = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
    logger.info('Facebook webhook tasdiqlandi');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

exports.handle = async (req, res) => {
  try {
    res.sendStatus(200);

    const body = req.body;

    if (body.object !== 'page') return;

    for (const entry of body.entry || []) {
      const pageId = entry.id;

      // Facebook Messenger xabarlari
      for (const messagingEvent of entry.messaging || []) {
        if (messagingEvent.message) {
          await processMessengerMessage(messagingEvent, pageId);
        } else if (messagingEvent.postback) {
          await processPostback(messagingEvent, pageId);
        }
      }

      // Facebook sahifa postlari (comments, leads)
      for (const change of entry.changes || []) {
        if (change.field === 'leadgen') {
          await processLeadgenForm(change.value, pageId);
        } else if (change.field === 'feed') {
          await processFeedChange(change.value, pageId);
        }
      }
    }
  } catch (error) {
    logger.error('Facebook webhook xatosi:', error);
  }
};

async function processMessengerMessage(event, pageId) {
  const senderId = event.sender.id;

  const integration = await db('integrations')
    .where({ type: 'facebook', status: 'active' })
    .whereRaw("credentials->>'page_id' = ?", [pageId])
    .first();

  if (!integration) return;

  const orgId = integration.organization_id;

  let contact = await db('contacts')
    .where({ organization_id: orgId, facebook_id: senderId })
    .first();

  if (!contact) {
    // Facebook foydalanuvchi ma'lumotlarini olish
    let fbName = { first_name: '', last_name: '' };
    try {
      const axios = require('axios');
      const userInfo = await axios.get(
        `https://graph.facebook.com/${senderId}?fields=first_name,last_name&access_token=${integration.credentials.access_token}`
      );
      fbName = userInfo.data;
    } catch {}

    const [newContact] = await db('contacts').insert({
      organization_id: orgId,
      first_name: fbName.first_name,
      last_name: fbName.last_name,
      facebook_id: senderId,
      source: 'facebook',
    }).returning('*');

    contact = newContact;

    const operatorId = await autoAssignOperator(orgId);
    await db('leads').insert({
      organization_id: orgId,
      contact_id: contact.id,
      assigned_to: operatorId,
      title: `Facebook Messenger: ${fbName.first_name} ${fbName.last_name}`,
      source: 'facebook',
      source_id: senderId,
      status: 'new',
    });
  }

  let conversation = await db('conversations')
    .where({ organization_id: orgId, channel: 'facebook', channel_conversation_id: senderId })
    .first();

  if (!conversation) {
    const [newConv] = await db('conversations').insert({
      organization_id: orgId,
      contact_id: contact.id,
      channel: 'facebook',
      channel_conversation_id: senderId,
    }).returning('*');
    conversation = newConv;
  }

  const message = event.message;
  await db('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'contact',
    sender_id: contact.id,
    external_id: message.mid,
    type: message.attachments ? 'file' : 'text',
    content: message.text || '',
    sent_at: new Date(event.timestamp),
  });

  await db('conversations')
    .where({ id: conversation.id })
    .update({ last_message_at: new Date(), unread_count: db.raw('unread_count + 1') });
}

async function processLeadgenForm(value, pageId) {
  // Facebook Lead Ads formlarini qayta ishlash
  logger.info('Facebook Lead form:', value);
}

async function processFeedChange(value, pageId) {
  // Facebook sahifa postlari va izohlarni qayta ishlash
  logger.info('Facebook feed change:', value.item);
}

async function processPostback(event, pageId) {
  logger.info('Facebook postback:', event.postback);
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
