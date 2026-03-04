const db = require('../../../database/connection');
const logger = require('../../../config/logger');

exports.verify = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    logger.info('Instagram webhook tasdiqlandi');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

exports.handle = async (req, res) => {
  try {
    res.sendStatus(200);

    const body = req.body;

    if (body.object !== 'instagram') return;

    for (const entry of body.entry || []) {
      const igAccountId = entry.id;

      // Instagram Direct Messages
      for (const messagingEvent of entry.messaging || []) {
        if (messagingEvent.message) {
          await processDirectMessage(messagingEvent, igAccountId);
        }
      }

      // Instagram feed o'zgarishlari (comments, mentions)
      for (const change of entry.changes || []) {
        if (change.field === 'comments') {
          await processComment(change.value, igAccountId);
        } else if (change.field === 'mentions') {
          await processMention(change.value, igAccountId);
        }
      }
    }
  } catch (error) {
    logger.error('Instagram webhook xatosi:', error);
  }
};

async function processDirectMessage(event, igAccountId) {
  const senderId = event.sender.id;

  const integration = await db('integrations')
    .where({ type: 'instagram', status: 'active' })
    .whereRaw("credentials->>'instagram_account_id' = ?", [igAccountId])
    .first();

  if (!integration) return;

  const orgId = integration.organization_id;

  let contact = await db('contacts')
    .where({ organization_id: orgId, instagram_id: senderId })
    .first();

  if (!contact) {
    const [newContact] = await db('contacts').insert({
      organization_id: orgId,
      instagram_id: senderId,
      source: 'instagram',
    }).returning('*');

    contact = newContact;

    const operatorId = await autoAssignOperator(orgId);
    await db('leads').insert({
      organization_id: orgId,
      contact_id: contact.id,
      assigned_to: operatorId,
      title: `Instagram DM: ${senderId}`,
      source: 'instagram',
      source_id: senderId,
      status: 'new',
    });
  }

  let conversation = await db('conversations')
    .where({ organization_id: orgId, channel: 'instagram', channel_conversation_id: senderId })
    .first();

  if (!conversation) {
    const [newConv] = await db('conversations').insert({
      organization_id: orgId,
      contact_id: contact.id,
      channel: 'instagram',
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
    type: message.attachments ? getAttachmentType(message.attachments[0]) : 'text',
    content: message.text || '',
    sent_at: new Date(event.timestamp),
  });

  await db('conversations')
    .where({ id: conversation.id })
    .update({ last_message_at: new Date(), unread_count: db.raw('unread_count + 1') });
}

async function processComment(value, igAccountId) {
  // Instagram postga izoh — yangi lead sifatida qayta ishlash
  logger.info('Instagram izoh:', value);
}

async function processMention(value, igAccountId) {
  // Instagram mention — yangi lead
  logger.info('Instagram mention:', value);
}

function getAttachmentType(attachment) {
  const type = attachment.type;
  if (type === 'image') return 'image';
  if (type === 'video') return 'video';
  if (type === 'audio') return 'audio';
  return 'file';
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
