const api = require('../api');
const { formatAmount, formatDate } = require('../utils');

// /start komandasi
exports.handleStart = (bot) => async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name;

  const keyboard = {
    inline_keyboard: [
      [{ text: '🔑 Kirish', callback_data: 'login_prompt' }],
      [{ text: '❓ Yordam', callback_data: 'help' }],
    ],
  };

  await bot.sendMessage(chatId, `
👋 <b>Salom, ${firstName}!</b>

<b>AGU CRM Operator Boti</b>ga xush kelibsiz!

Bu bot orqali siz:
✅ Leadlaringizni ko'rishingiz
✅ Bitimlaringizni boshqarishingiz
✅ Vazifalaringizni bajarishingiz
✅ Mijozlar bilan suhbat qilishingiz mumkin

Boshlash uchun tizimga kiring:
  `, { parse_mode: 'HTML', reply_markup: keyboard });
};

// /login komandasi
exports.handleLogin = (bot) => async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const result = await api.login(telegramId, msg.from.username);
    if (result.success) {
      await api.saveSession(telegramId, {
        token: result.data.accessToken,
        userId: telegramId,
      });

      await bot.sendMessage(chatId, `
✅ <b>Muvaffaqiyatli kirdingiz!</b>

Quyidagi komandalardan foydalaning:
/leads — Leadlarim
/deals — Bitimlarim
/tasks — Vazifalarim
/stats — Statistika
      `, { parse_mode: 'HTML' });
    }
  } catch (err) {
    await bot.sendMessage(chatId, `
❌ <b>Kirish imkonsiz</b>

Telegram akkauntingiz tizimda ro'yxatdan o'tgan bo'lishi kerak.
Administrator bilan bog'laning.
    `, { parse_mode: 'HTML' });
  }
};

// /leads — Yangi leadlar
exports.handleLeads = (bot) => async (msg) => {
  const chatId = msg.chat.id;
  const session = await api.getSession(msg.from.id);

  if (!session) {
    return bot.sendMessage(chatId, '⚠️ Avval tizimga kiring: /start');
  }

  try {
    const result = await api.getMyLeads(session.token);
    const leads = result.data || [];

    if (leads.length === 0) {
      return bot.sendMessage(chatId, '📭 Hozircha lead yo\'q', { parse_mode: 'HTML' });
    }

    let text = `📋 <b>Leadlarim (${leads.length} ta)</b>\n\n`;

    for (const lead of leads.slice(0, 8)) {
      const statusEmoji = { new: '🆕', processing: '⏳', qualified: '✅', converted: '🎉', rejected: '❌' }[lead.status] || '❓';
      text += `${statusEmoji} <b>${lead.title}</b>\n`;
      text += `   📡 ${lead.source || 'manual'} • ${formatDate(lead.created_at)}\n`;
      if (lead.contact_name) text += `   👤 ${lead.contact_name}\n`;
      text += '\n';
    }

    const keyboard = {
      inline_keyboard: [[
        { text: '🔄 Yangilash', callback_data: 'refresh_leads' },
        { text: '➕ Yangi lead', callback_data: 'create_lead' },
      ]],
    };

    await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (err) {
    await bot.sendMessage(chatId, '❌ Ma\'lumot olishda xato');
  }
};

// /deals
exports.handleDeals = (bot) => async (msg) => {
  const chatId = msg.chat.id;
  const session = await api.getSession(msg.from.id);
  if (!session) return bot.sendMessage(chatId, '⚠️ Avval tizimga kiring: /start');

  try {
    const result = await api.getDeals(session.token);
    const deals = result.data || [];

    if (deals.length === 0) {
      return bot.sendMessage(chatId, '📭 Hozircha bitim yo\'q');
    }

    let text = `💼 <b>Faol bitimlar (${deals.length} ta)</b>\n\n`;

    for (const deal of deals.slice(0, 8)) {
      text += `💰 <b>${deal.title}</b>\n`;
      text += `   💵 ${formatAmount(deal.amount)} ${deal.currency}\n`;
      text += `   📊 ${deal.stage_name || '—'}\n`;
      if (deal.contact_name) text += `   👤 ${deal.contact_name}\n`;
      text += '\n';
    }

    await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
  } catch (err) {
    await bot.sendMessage(chatId, '❌ Ma\'lumot olishda xato');
  }
};

// /tasks
exports.handleTasks = (bot) => async (msg) => {
  const chatId = msg.chat.id;
  const session = await api.getSession(msg.from.id);
  if (!session) return bot.sendMessage(chatId, '⚠️ Avval tizimga kiring: /start');

  try {
    const result = await api.getTasks(session.token);
    const tasks = result.data || [];

    if (tasks.length === 0) {
      return bot.sendMessage(chatId, '✅ Barcha vazifalar bajarilgan!');
    }

    let text = `📝 <b>Vazifalarim (${tasks.length} ta)</b>\n\n`;

    const keyboard = { inline_keyboard: [] };

    for (const task of tasks.slice(0, 5)) {
      const typeEmoji = { task: '📋', call: '📞', meeting: '🤝', email: '📧', follow_up: '🔄' }[task.type] || '📋';
      const priorityEmoji = { urgent: '🔴', high: '🟠', medium: '🟡', low: '⚪' }[task.priority] || '⚪';

      text += `${typeEmoji} ${priorityEmoji} <b>${task.title}</b>\n`;
      if (task.due_date) text += `   ⏰ ${formatDate(task.due_date)}\n`;
      if (task.contact_name) text += `   👤 ${task.contact_name}\n`;
      text += '\n';

      keyboard.inline_keyboard.push([{
        text: `✅ "${task.title.substring(0, 25)}..." bajarildi`,
        callback_data: `complete_task:${task.id}`,
      }]);
    }

    await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (err) {
    await bot.sendMessage(chatId, '❌ Ma\'lumot olishda xato');
  }
};

// /stats
exports.handleStats = (bot) => async (msg) => {
  const chatId = msg.chat.id;
  const session = await api.getSession(msg.from.id);
  if (!session) return bot.sendMessage(chatId, '⚠️ Avval tizimga kiring: /start');

  try {
    const result = await api.getStats(session.token);
    const s = result.data;

    const text = `
📊 <b>Statistika</b>

👥 Jami mijozlar: <b>${s.totalContacts}</b>
📋 Faol bitimlar: <b>${s.openDeals}</b>
💰 Oylik daromad: <b>${formatAmount(s.monthlyRevenue)} UZS</b>

📅 <b>Bugun:</b>
🆕 Yangi leadlar: <b>${s.todayLeads}</b>
💵 Daromad: <b>${formatAmount(s.todayRevenue)} UZS</b>
    `;

    await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
  } catch (err) {
    await bot.sendMessage(chatId, '❌ Statistika olishda xato');
  }
};

// /help
exports.handleHelp = (bot) => async (msg) => {
  const text = `
🤖 <b>AGU CRM Bot - Komandalar</b>

/start — Boshlanish
/leads — Leadlarim ro'yxati
/deals — Faol bitimlar
/tasks — Vazifalarim
/stats — Statistika

<b>💡 Maslahat:</b>
Suhbatda bo'lganingizda, oddiy xabar yuborish orqali mijozga javob bera olasiz.
  `;
  await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
};

// Callback query handler
exports.handleCallbackQuery = (bot) => async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const session = await api.getSession(query.from.id);

  await bot.answerCallbackQuery(query.id);

  if (data === 'refresh_leads') {
    return exports.handleLeads(bot)({ chat: { id: chatId }, from: query.from });
  }

  if (data === 'help') {
    return exports.handleHelp(bot)({ chat: { id: chatId } });
  }

  if (data === 'login_prompt') {
    return bot.sendMessage(chatId, '🔑 Kirish uchun quyidagini yuboring:\n<code>/login</code>', { parse_mode: 'HTML' });
  }

  if (data.startsWith('complete_task:')) {
    if (!session) return bot.sendMessage(chatId, '⚠️ Avval tizimga kiring');
    const taskId = data.split(':')[1];
    try {
      await api.completeTask(taskId, session.token);
      await bot.sendMessage(chatId, '✅ Vazifa bajarildi!');
    } catch {
      await bot.sendMessage(chatId, '❌ Xato yuz berdi');
    }
  }
};
