const express = require('express');
const router = express.Router();

const telegramWebhook = require('../modules/integrations/telegram/telegram.webhook');
const whatsappWebhook = require('../modules/integrations/whatsapp/whatsapp.webhook');
const facebookWebhook = require('../modules/integrations/facebook/facebook.webhook');
const instagramWebhook = require('../modules/integrations/instagram/instagram.webhook');

// Telegram webhook
router.post('/telegram/:token', telegramWebhook.handle);

// WhatsApp webhook
router.get('/whatsapp', whatsappWebhook.verify);
router.post('/whatsapp', whatsappWebhook.handle);

// Facebook webhook
router.get('/facebook', facebookWebhook.verify);
router.post('/facebook', facebookWebhook.handle);

// Instagram webhook
router.get('/instagram', instagramWebhook.verify);
router.post('/instagram', instagramWebhook.handle);

module.exports = router;
