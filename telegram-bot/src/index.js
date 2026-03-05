require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const api = require('./api');
const handlers = require('./handlers');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN kiritilmagan!');
  process.exit(1);
}

// Polling rejimida ishlaydigan bot (operatorlar uchun)
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('AGU CRM Operator Bot ishga tushdi...');

// Komandalar
bot.onText(/\/start/, handlers.handleStart(bot));
bot.onText(/\/leads/, handlers.handleLeads(bot));
bot.onText(/\/deals/, handlers.handleDeals(bot));
bot.onText(/\/tasks/, handlers.handleTasks(bot));
bot.onText(/\/stats/, handlers.handleStats(bot));
bot.onText(/\/help/, handlers.handleHelp(bot));
bot.onText(/\/login (.+)/, handlers.handleLogin(bot));

// Callback queries (inline klaviatura)
bot.on('callback_query', handlers.handleCallbackQuery(bot));

// Xabar yuborish
bot.on('message', async (msg) => {
  if (msg.text?.startsWith('/')) return; // Komandalar qayta ishlanmasin

  const chatId = msg.chat.id;
  const session = await api.getSession(chatId);

  if (!session?.conversationId) return;

  // Operator xabarini CRM ga yuborish
  try {
    await api.sendMessage(session.conversationId, msg.text, session.token);
  } catch (err) {
    console.error('Xabar yuborishda xato:', err.message);
  }
});

// Xato qayta ishlash
bot.on('polling_error', (err) => {
  console.error('Polling xatosi:', err.message);
});

process.on('SIGTERM', () => {
  bot.stopPolling();
  console.log('Bot to\'xtatildi');
  process.exit(0);
});
