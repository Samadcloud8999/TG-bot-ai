/**
 * src/controllers/profileController.js
 * Личный кабинет пользователя
 */

const userService = require('../services/userService');
const keyboards   = require('../utils/keyboards');
const { getUserDisplayName, formatDate, formatPlan, progressBar } = require('../utils/helpers');

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
      `• 🆓 Бесплатный: 10 запросов/день\n` +
      `• ⭐ Premium: 100 запросов/день\n\n` +
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
      `• 100 запросов в день\n` +
      `• Приоритетная обработка\n` +
      `• Расширенный анализ фото\n` +
      `• Длинные конспекты\n\n` +
      `💳 Для активации Premium свяжитесь с @AdminUsername\n\n` +
      `_Или напишите /admin и введите промо-код_`;

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      ...keyboards.backToMenu(),
    });
  },
};

function getActivityLevel(messages) {
  if (messages >= 500) return '🔥 Супер-активный';
  if (messages >= 100) return '⚡ Активный';
  if (messages >= 20)  return '👍 Обычный';
  return '🌱 Новичок';
}

module.exports = profileController;
