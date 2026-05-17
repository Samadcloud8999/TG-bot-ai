/**
 * src/controllers/profileController.js
 * Личный кабинет пользователя
 */

const userService = require('../services/userService');
const keyboards   = require('../utils/keyboards');
const { query }  = require('../database/connection');
const { getUserDisplayName, formatDate, formatPlan, progressBar } = require('../utils/helpers');

function getBot() { return require('../bot').getBot(); }

const PAYMENT_PROVIDER_TOKEN = process.env.PAYMENT_PROVIDER_TOKEN || '';
const PAYMENT_CURRENCY       = process.env.PAYMENT_CURRENCY || 'RUB';
const PREMIUM_PRICE          = parseInt(process.env.PREMIUM_PRICE, 10) || 29900;
const ADMIN_USERNAME         = process.env.ADMIN_USERNAME || 'VOVOVU4';

const profileController = {
  /**
   * /profile — показать личный кабинет
   */
  async showProfile(ctx) {
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    const user  = ctx.dbUser;
    const stats = await userService.getStats(user.id);
    const name  = getUserDisplayName(user);

    const usedPct = Math.round((user.used_today / user.daily_limit) * 100);
    const bar     = progressBar(user.used_today, user.daily_limit);

    const text =
      `👤 *Личный кабинет*\n\n` +
      `📋 *Информация:*\n` +
      `• Имя: ${name}\n` +
      `• Username: ${user.username ? '@' + user.username : 'не задан'}\n` +
      `• Telegram ID: \`${user.telegram_id}\`\n` +
      `• Тарифный план: ${formatPlan(user.plan)}\n` +
      `• Дата регистрации: ${formatDate(user.created_at)}\n\n` +
      `📊 *Статистика:*\n` +
      `• Всего сообщений: ${stats.messages}\n` +
      `• Конспектов создано: ${stats.notes}\n` +
      `• Тестов пройдено: ${stats.quizzes}\n\n` +
      `⚡ *Лимит сегодня:*\n` +
      `${bar} ${user.used_today}/${user.daily_limit} (${usedPct}%)`;

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboards.profileMenu(),
      });
    } catch {
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...keyboards.profileMenu(),
      });
    }
  },

  /**
   * Показать лимиты
   */
  async showLimits(ctx) {
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    const user = ctx.dbUser;
    const remaining = user.daily_limit - user.used_today;
    const bar = progressBar(user.used_today, user.daily_limit);

    const text =
      `📊 *Твои лимиты*\n\n` +
      `${bar}\n` +
      `Использовано: *${user.used_today}* из *${user.daily_limit}*\n` +
      `Осталось: *${remaining}* запросов\n\n` +
      `💎 *Планы:*\n` +
      `• 🆓 Бесплатный: 200 запросов/день\n` +
      `• ⭐ Premium: 2000 запросов/день\n\n` +
      `Лимит обновляется каждый день в 00:00`;

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboards.profileMenu(),
      });
    } catch {
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...keyboards.profileMenu(),
      });
    }
  },

  /**
   * Показать расширенную статистику
   */
  async showStats(ctx) {
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    const user  = ctx.dbUser;
    const stats = await userService.getStats(user.id);

    const text =
      `📈 *Твоя статистика*\n\n` +
      `💬 Всего сообщений: *${stats.messages}*\n` +
      `📝 Конспектов: *${stats.notes}*\n` +
      `🧪 Тестов пройдено: *${stats.quizzes}*\n\n` +
      `🎯 Активность: ${getActivityLevel(stats.messages)}`;

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      ...keyboards.backToMenu(),
    });
  },

  /**
   * Обновление плана (заглушка — интегрировать с платёжной системой)
   */
  async handleUpgrade(ctx) {
    await ctx.answerCbQuery();

    const text =
      `⭐ *Premium план*\n\n` +
      `🚀 Что даёт Premium:\n` +
      `• 2000 запросов в день\n` +
      `• Приоритетная обработка\n` +
      `• Расширенный анализ фото\n` +
      `• Длинные конспекты\n\n`;

    if (!PAYMENT_PROVIDER_TOKEN) {
      const fallbackText =
        text +
        `💳 Оплатите мне звёздами в Telegram через @${ADMIN_USERNAME}.\n` +
        `После оплаты нажмите кнопку «Я оплатил» — я уведомлю администратора и проверю оплату автоматически.`;

      return await ctx.reply(fallbackText, {
        parse_mode: 'Markdown',
        ...require('telegraf').Markup.inlineKeyboard([
          [require('telegraf').Markup.button.callback('💳 Я оплатил звёздами', 'profile_paid')],
          [require('telegraf').Markup.button.callback('🔙 Главное меню', 'menu_back')],
        ]),
      });
    }

    const invoicePayload = `premium_${ctx.from.id}_${Date.now()}`;
    const prices = [
      { label: 'Premium доступ', amount: PREMIUM_PRICE },
    ];

    return await ctx.replyWithInvoice(
      'Premium доступ EduAI Bot',
      'Получите 2000 запросов в день и расширенные функции.',
      invoicePayload,
      PAYMENT_PROVIDER_TOKEN,
      PAYMENT_CURRENCY,
      prices,
      {
        need_name: true,
        need_phone_number: false,
        need_email: false,
        is_flexible: false,
      }
    );
  },

  async requestPaymentConfirmation(ctx) {
    await ctx.answerCbQuery();
    ctx.session = ctx.session || {};
    ctx.session.awaitingPaymentConfirmation = true;

    await ctx.reply(
      '💬 *Подтвердите оплату*\n\n' +
      'Отправьте мне сообщение с подтверждением оплаты или кодом транзакции.',
      { parse_mode: 'Markdown', ...keyboards.cancel() }
    );
  },

  async processPaymentConfirmation(ctx) {
    ctx.session.awaitingPaymentConfirmation = false;

    const user = ctx.dbUser;
    if (!user) {
      return await ctx.reply('❌ Не удалось найти ваш профиль. Попробуйте снова.');
    }

    const text = ctx.message.text?.trim() || 'Пользователь отправил запрос на подтверждение оплаты.';
    const bot = getBot();
    const adminIds = (process.env.ADMIN_IDS || '')
      .split(',')
      .map(id => parseInt(id.trim()))
      .filter(Boolean);

    const result = await query(
      `INSERT INTO payment_requests (user_id, amount, currency, note, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
      [user.id, PREMIUM_PRICE, PAYMENT_CURRENCY, text]
    );

    const requestId = result.rows[0]?.id;
    const requestText = `💳 *Новый запрос на подтверждение оплаты* (#${requestId})\n\n` +
      `Пользователь: @${ctx.from.username || ctx.from.id}\n` +
      `Telegram ID: \`${ctx.from.id}\`\n` +
      `Сумма: ${PREMIUM_PRICE} ${PAYMENT_CURRENCY}\n` +
      `Комментарий: ${text}`;

    for (const adminId of adminIds) {
      try {
        await bot.telegram.sendMessage(adminId, requestText, { parse_mode: 'Markdown' });
      } catch (error) {
        // ignore send failures
      }
    }

    await ctx.reply(
      '✅ Спасибо! Запрос отправлен администратору.\n' +
      'После подтверждения оплаты ваш план будет обновлён.',
      { parse_mode: 'Markdown', ...keyboards.backToMenu() }
    );
  },
};

function getActivityLevel(messages) {
  if (messages >= 500) return '🔥 Супер-активный';
  if (messages >= 100) return '⚡ Активный';
  if (messages >= 20)  return '👍 Обычный';
  return '🌱 Новичок';
}

module.exports = profileController;
