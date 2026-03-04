const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth');
const db = require('../../database/connection');
const axios = require('axios');
const logger = require('../../config/logger');

router.use(authenticate);
router.use(authorize('admin'));

// Barcha integratsiyalar ro'yxati
router.get('/', async (req, res, next) => {
  try {
    const integrations = await db('integrations')
      .where({ organization_id: req.organizationId })
      .select('id', 'type', 'name', 'status', 'last_sync_at', 'error_message', 'settings', 'created_at');

    res.json({ success: true, data: integrations });
  } catch (error) {
    next(error);
  }
});

// Telegram Bot qo'shish
router.post('/telegram', async (req, res, next) => {
  try {
    const { botToken, name } = req.body;

    // Token tekshirish
    const telegramResponse = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
    if (!telegramResponse.data.ok) {
      return res.status(400).json({ success: false, message: 'Noto\'g\'ri Telegram bot token' });
    }

    const botInfo = telegramResponse.data.result;

    // Webhook o'rnatish
    const webhookUrl = `${process.env.APP_URL}/webhook/telegram/${botToken}`;
    await axios.post(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query', 'my_chat_member'],
    });

    const [integration] = await db('integrations').insert({
      organization_id: req.organizationId,
      type: 'telegram',
      name: name || `@${botInfo.username}`,
      credentials: { bot_token: botToken, bot_id: botInfo.id, username: botInfo.username },
      settings: { webhook_url: webhookUrl },
      status: 'active',
    }).returning('id', 'type', 'name', 'status');

    logger.info(`Telegram bot qo'shildi: @${botInfo.username}`);
    res.status(201).json({ success: true, data: integration });
  } catch (error) {
    next(error);
  }
});

// WhatsApp Business qo'shish
router.post('/whatsapp', async (req, res, next) => {
  try {
    const { accessToken, phoneNumberId, businessAccountId, name } = req.body;

    const [integration] = await db('integrations').insert({
      organization_id: req.organizationId,
      type: 'whatsapp',
      name: name || 'WhatsApp Business',
      credentials: {
        access_token: accessToken,
        phone_number_id: phoneNumberId,
        business_account_id: businessAccountId,
      },
      settings: { webhook_url: `${process.env.APP_URL}/webhook/whatsapp` },
      status: 'active',
    }).returning('id', 'type', 'name', 'status');

    res.status(201).json({ success: true, data: integration });
  } catch (error) {
    next(error);
  }
});

// Facebook Sahifa qo'shish
router.post('/facebook', async (req, res, next) => {
  try {
    const { accessToken, pageId, name } = req.body;

    const [integration] = await db('integrations').insert({
      organization_id: req.organizationId,
      type: 'facebook',
      name: name || 'Facebook Page',
      credentials: { access_token: accessToken, page_id: pageId },
      settings: { webhook_url: `${process.env.APP_URL}/webhook/facebook` },
      status: 'active',
    }).returning('id', 'type', 'name', 'status');

    res.status(201).json({ success: true, data: integration });
  } catch (error) {
    next(error);
  }
});

// Instagram qo'shish
router.post('/instagram', async (req, res, next) => {
  try {
    const { accessToken, instagramAccountId, name } = req.body;

    const [integration] = await db('integrations').insert({
      organization_id: req.organizationId,
      type: 'instagram',
      name: name || 'Instagram Business',
      credentials: { access_token: accessToken, instagram_account_id: instagramAccountId },
      settings: { webhook_url: `${process.env.APP_URL}/webhook/instagram` },
      status: 'active',
    }).returning('id', 'type', 'name', 'status');

    res.status(201).json({ success: true, data: integration });
  } catch (error) {
    next(error);
  }
});

// Integratsiyani o'chirish
router.delete('/:id', async (req, res, next) => {
  try {
    const integration = await db('integrations')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();

    if (!integration) {
      return res.status(404).json({ success: false, message: 'Integratsiya topilmadi' });
    }

    // Telegram webhookni o'chirish
    if (integration.type === 'telegram' && integration.credentials?.bot_token) {
      await axios.post(
        `https://api.telegram.org/bot${integration.credentials.bot_token}/deleteWebhook`
      ).catch(() => {});
    }

    await db('integrations').where({ id: req.params.id }).delete();
    res.json({ success: true, message: 'Integratsiya o\'chirildi' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
