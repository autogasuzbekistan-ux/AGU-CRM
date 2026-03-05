/**
 * AGU CRM — Broadcast Service
 * Segmentlangan ommaviy xabar yuborish tizimi
 */
const db = require('../../database/connection');
const logger = require('../../config/logger');
const { sendMessage } = require('../integrations/message.service');

/**
 * Segment filterlar asosida kontaktlarni topish
 */
async function getSegmentContacts(orgId, filters = {}, channel = 'all') {
  let query = db('contacts as c')
    .where({ 'c.organization_id': orgId })
    .whereNull('c.deleted_at');

  // Kanal filteri: tegishli channel_id mavjud bo'lishi kerak
  if (channel === 'telegram') {
    query = query.whereNotNull('c.telegram_id');
  } else if (channel === 'whatsapp') {
    query = query.whereNotNull('c.phone');
  } else if (channel === 'sms') {
    query = query.whereNotNull('c.phone');
  } else {
    // 'all' — kamida bitta kanal bo'lsin
    query = query.where(function () {
      this.whereNotNull('c.telegram_id').orWhereNotNull('c.phone');
    });
  }

  if (filters.tags?.length) {
    query = query.whereRaw('c.tags && ?', [filters.tags]);
  }
  if (filters.source) {
    query = query.where({ 'c.source': filters.source });
  }
  if (filters.city) {
    query = query.whereILike('c.city', `%${filters.city}%`);
  }
  if (filters.language) {
    query = query.where({ 'c.language': filters.language });
  }

  return query.select('c.id', 'c.first_name', 'c.last_name', 'c.phone', 'c.telegram_id', 'c.email');
}

/**
 * Broadcast yuborish (fon rejimida)
 * @param {string} broadcastId
 */
async function executeBroadcast(broadcastId) {
  const broadcast = await db('broadcasts').where({ id: broadcastId }).first();
  if (!broadcast || broadcast.status === 'cancelled') return;

  await db('broadcasts').where({ id: broadcastId }).update({
    status: 'sending',
    started_at: new Date(),
  });

  const contacts = await getSegmentContacts(
    broadcast.organization_id,
    broadcast.segment_filters || {},
    broadcast.channel
  );

  // Recipients jadvaliga qo'shish
  if (contacts.length > 0) {
    const recipients = contacts.map((c) => ({
      broadcast_id: broadcastId,
      contact_id: c.id,
      channel: broadcast.channel === 'all'
        ? (c.telegram_id ? 'telegram' : 'sms')
        : broadcast.channel,
      channel_id: broadcast.channel === 'telegram' || (broadcast.channel === 'all' && c.telegram_id)
        ? c.telegram_id
        : c.phone,
    }));

    await db('broadcast_recipients')
      .insert(recipients)
      .onConflict(['broadcast_id', 'contact_id'])
      .ignore();
  }

  await db('broadcasts').where({ id: broadcastId }).update({ total_recipients: contacts.length });

  // Xabar yuborish (kanal bo'yicha)
  let sentCount = 0, failedCount = 0;

  for (const contact of contacts) {
    try {
      const channel = broadcast.channel === 'all'
        ? (contact.telegram_id ? 'telegram' : 'sms')
        : broadcast.channel;

      const channelId = channel === 'telegram' ? contact.telegram_id : contact.phone;
      if (!channelId) {
        await db('broadcast_recipients')
          .where({ broadcast_id: broadcastId, contact_id: contact.id })
          .update({ status: 'skipped', error_message: 'No channel ID' });
        continue;
      }

      // Xabarni personalizatsiya qilish
      const firstName = contact.first_name || '';
      const text = broadcast.message
        .replace(/\{\{ism\}\}/gi, firstName)
        .replace(/\{\{name\}\}/gi, firstName);

      if (channel === 'sms') {
        // SMS yuborish (Eskiz.uz)
        await sendSMS(channelId, text, broadcast.organization_id);
      } else {
        // Telegram/WhatsApp/etc
        await sendMessage(broadcast.organization_id, channel, channelId, text);
      }

      await db('broadcast_recipients')
        .where({ broadcast_id: broadcastId, contact_id: contact.id })
        .update({ status: 'sent', sent_at: new Date() });

      sentCount++;

      // Rate limit: har 0.5 soniyada 1 ta xabar
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      failedCount++;
      logger.error(`Broadcast send error contact=${contact.id}:`, err.message);
      await db('broadcast_recipients')
        .where({ broadcast_id: broadcastId, contact_id: contact.id })
        .update({ status: 'failed', error_message: err.message });
    }

    // Bekor qilinganmi tekshirish
    const current = await db('broadcasts').where({ id: broadcastId }).first();
    if (current?.status === 'cancelled') break;
  }

  await db('broadcasts').where({ id: broadcastId }).update({
    status: 'sent',
    completed_at: new Date(),
    sent_count: sentCount,
    failed_count: failedCount,
  });

  logger.info(`Broadcast completed id=${broadcastId} sent=${sentCount} failed=${failedCount}`);
}

/**
 * SMS yuborish (Eskiz.uz)
 */
async function sendSMS(phone, text, orgId) {
  const ESKIZ_TOKEN = process.env.ESKIZ_TOKEN;
  if (!ESKIZ_TOKEN) throw new Error('ESKIZ_TOKEN not configured');

  const res = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ESKIZ_TOKEN}`,
    },
    body: JSON.stringify({
      mobile_phone: phone.replace(/\D/g, ''),
      message: text,
      from: process.env.ESKIZ_FROM || '4546',
    }),
  });

  if (!res.ok) throw new Error(`SMS failed: ${res.status}`);
  return res.json();
}

module.exports = { executeBroadcast, getSegmentContacts };
