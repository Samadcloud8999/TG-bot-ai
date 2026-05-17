/**
 * src/controllers/adminController.js
 * Панель администратора — вход по паролю, статистика, управление пользователями
 *
 * ПАРОЛЬ АДМИНИСТРАТОРА: A4545Z
 * Хранится в .env: ADMIN_PASSWORD=A4545Z
 */

const userService = require('../services/userService');
const keyboards   = require('../utils/keyboards');
const { query }   = require('../database/connection');
const { getBot }  = require('../bot');
const logger      = require('../utils/logger');
const { formatDate, getUserDisplayName } = require('../utils/helpers');

// Множество авторизованных администраторов (в памяти)
const authorizedAdmins = new Set();

// Пароль из .env (по умолчанию A4545Z)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'A4545Z';

/**
 * Проверить является ли пользователь авторизованным администратором
 */
function isAuthorized(ctx) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return false;

  // Проверяем в памяти (авторизован через пароль в текущей сессии)
  if (authorizedAdmins.has(telegramId)) return true;

  // Или в БД (is_admin = true)
  if (ctx.dbUser?.is_admin) {
    authorizedAdmins.add(telegramId);
    return true;
  }

  return false;
}

const adminController = {
  /**
   * /admin — вход в панель
   */
  async handleAdmin(ctx) {
    if (isAuthorized(ctx)) {
      return adminController.showAdminPanel(ctx);
    }

    ctx.session = ctx.session || {};
    ctx.session.awaitingAdminPassword = true;

    await ctx.reply(
      '🔐 *Панель администратора*\n\n' +
      'Введите пароль для входа:',
      {
        parse_mode: 'Markdown',
        ...require('telegraf').Markup.inlineKeyboard([
          [require('telegraf').Markup.button.callback('❌ Отмена', 'menu_back')],
        ]),
      }
    );
  },

  /**
   * Запросить пароль (через кнопку)
   */
  async requestAdminLogin(ctx) {
    await ctx.answerCbQuery();

    if (isAuthorized(ctx)) {
      return adminController.showAdminPanel(ctx);
    }

    ctx.session = ctx.session || {};
    ctx.session.awaitingAdminPassword = true;

    await ctx.reply(
      '🔐 Введите пароль администратора:',
      {
        ...require('telegraf').Markup.inlineKeyboard([
          [require('telegraf').Markup.button.callback('❌ Отмена', 'menu_back')],
        ]),
      }
    );
  },

  /**
   * Проверить введённый пароль
   */
  async verifyAdminPassword(ctx) {
    const input = ctx.message.text?.trim();
    ctx.session.awaitingAdminPassword = false;

    // Удаляем сообщение с паролем для безопасности
    try {
      await ctx.deleteMessage();
    } catch {}

    if (input === ADMIN_PASSWORD) {
      const telegramId = ctx.from.id;
      authorizedAdmins.add(telegramId);

      logger.info(`Admin access granted: ${telegramId} (@${ctx.from.username})`);

      await ctx.reply('✅ Доступ разрешён!');
      return adminController.showAdminPanel(ctx);
    } else {
      logger.warn(`Failed admin login attempt: ${ctx.from.id} (@${ctx.from.username})`);

      // Логируем неудачную попытку
      await query(
        `INSERT INTO error_logs (user_id, error_type, message, context)
         VALUES ($1, $2, $3, $4)`,
        [
          ctx.dbUser?.id || null,
          'ADMIN_AUTH_FAIL',
          'Failed admin login attempt',
          JSON.stringify({ telegram_id: ctx.from.id }),
        ]
      );

      await ctx.reply(
        '❌ *Неверный пароль!*\n\nДоступ запрещён.',
        {
          parse_mode: 'Markdown',
          ...keyboards.backToMenu(),
        }
      );
    }
  },

  /**
   * Показать панель администратора
   */
  async showAdminPanel(ctx) {
    if (!isAuthorized(ctx)) {
      return ctx.reply('🚫 Доступ запрещён.', keyboards.backToMenu());
    }
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    const stats = await userService.getGlobalStats();

    const text =
      `🛠 *Панель администратора*\n\n` +
      `👥 Всего пользователей: *${stats.total_users}*\n` +
      `⭐ Premium: *${stats.premium_users}*\n` +
      `🚫 Заблокировано: *${stats.banned_users}*\n` +
      `🆕 За неделю: *${stats.new_week}*\n\n` +
      `💬 Сообщений: *${stats.total_messages}*\n` +
      `📝 Конспектов: *${stats.total_notes}*\n` +
      `🧪 Тестов: *${stats.total_quizzes}*\n\n` +
      `🔑 Авторизован как: @${ctx.from.username || ctx.from.id}`;

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboards.adminPanel(),
      });
    } catch {
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...keyboards.adminPanel(),
      });
    }
  },

  /**
   * Глобальная статистика
   */
  async showStats(ctx) {
    await ctx.answerCbQuery();
    if (!isAuthorized(ctx)) return ctx.reply('🚫 Доступ запрещён.');

    const stats = await userService.getGlobalStats();
    const text  =
      `📊 *Детальная статистика*\n\n` +
      `👥 Пользователей всего: ${stats.total_users}\n` +
      `⭐ Premium пользователей: ${stats.premium_users}\n` +
      `🚫 Заблокировано: ${stats.banned_users}\n` +
      `🆕 Новых за неделю: ${stats.new_week}\n\n` +
      `💬 Сообщений в истории: ${stats.total_messages}\n` +
      `📝 Конспектов создано: ${stats.total_notes}\n` +
      `🧪 Тестов пройдено: ${stats.total_quizzes}`;

    await ctx.reply(text, { parse_mode: 'Markdown', ...keyboards.adminPanel() });
  },

  /**
   * Список пользователей
   */
  async showUsers(ctx) {
    await ctx.answerCbQuery();
    if (!isAuthorized(ctx)) return ctx.reply('🚫 Доступ запрещён.');

    const users = await userService.getAllUsers(15, 0);

    let text = `👥 *Пользователи* (последние 15):\n\n`;
    for (const u of users) {
      const status = u.is_banned ? '🚫' : u.plan === 'premium' ? '⭐' : '🆓';
      text += `${status} ${u.first_name || 'Unknown'} (@${u.username || u.telegram_id})\n`;
      text += `   Запросов сегодня: ${u.used_today}/${u.daily_limit} | ${formatDate(u.created_at)}\n\n`;
    }

    await ctx.reply(text, { parse_mode: 'Markdown', ...keyboards.adminPanel() });
  },

  /**
   * Начать рассылку
   */
  async initBroadcast(ctx) {
    await ctx.answerCbQuery();
    if (!isAuthorized(ctx)) return ctx.reply('🚫 Доступ запрещён.');

    ctx.session.awaitingBroadcast = true;

    await ctx.reply(
      '📢 *Рассылка*\n\nНапишите сообщение для рассылки всем пользователям:',
      { parse_mode: 'Markdown', ...keyboards.cancel() }
    );
  },

  /**
   * Выполнить рассылку
   */
  async processBroadcast(ctx) {
    ctx.session.awaitingBroadcast = false;
    if (!isAuthorized(ctx)) return;

    const message = ctx.message.text;
    const bot     = getBot();

    // Получаем всех активных пользователей
    const result = await query(
      `SELECT telegram_id FROM users WHERE is_banned = FALSE`
    );

    const users   = result.rows;
    let sent      = 0;
    let failed    = 0;

    const statusMsg = await ctx.reply(`📤 Отправляю ${users.length} пользователям...`);

    for (const user of users) {
      try {
        await bot.telegram.sendMessage(
          user.telegram_id,
          `📢 *Сообщение от администратора:*\n\n${message}`,
          { parse_mode: 'Markdown' }
        );
        sent++;
        // Задержка 50ms между сообщениями (Telegram rate limit)
        await new Promise(r => setTimeout(r, 50));
      } catch {
        failed++;
      }
    }

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `✅ Рассылка завершена!\n\n📤 Отправлено: ${sent}\n❌ Ошибок: ${failed}`,
      { parse_mode: 'Markdown', ...keyboards.adminPanel() }
    );

    logger.info(`Broadcast sent: ${sent} success, ${failed} failed`);
  },

  /**
   * Управление лимитами
   */
  async manageLimits(ctx) {
    await ctx.answerCbQuery();
    if (!isAuthorized(ctx)) return ctx.reply('🚫 Доступ запрещён.');

    await ctx.reply(
      `⚙️ *Управление лимитами*\n\n` +
      `Текущие настройки:\n` +
      `• 🆓 Free: ${process.env.FREE_DAILY_LIMIT || 10} запросов/день\n` +
      `• ⭐ Premium: ${process.env.PREMIUM_DAILY_LIMIT || 100} запросов/день\n\n` +
      `Для изменения обновите переменные в .env файле:\n` +
      `\`FREE_DAILY_LIMIT=20\`\n` +
      `\`PREMIUM_DAILY_LIMIT=200\``,
      { parse_mode: 'Markdown', ...keyboards.adminPanel() }
    );
  },

  /**
   * Показать последние логи ошибок
   */
  async showLogs(ctx) {
    await ctx.answerCbQuery();
    if (!isAuthorized(ctx)) return ctx.reply('🚫 Доступ запрещён.');

    const result = await query(
      `SELECT error_type, message, created_at FROM error_logs
       ORDER BY created_at DESC LIMIT 10`
    );

    if (result.rows.length === 0) {
      return ctx.reply('📋 Логи ошибок пусты.', keyboards.adminPanel());
    }

    let text = `📋 *Последние ошибки:*\n\n`;
    for (const log of result.rows) {
      text += `⚠️ [${log.error_type}] ${formatDate(log.created_at)}\n`;
      text += `${log.message?.slice(0, 100)}\n\n`;
    }

    await ctx.reply(text, { parse_mode: 'Markdown', ...keyboards.adminPanel() });
  },

  /**
   * Начать процедуру бана
   */
  async initBan(ctx) {
    await ctx.answerCbQuery();
    if (!isAuthorized(ctx)) return ctx.reply('🚫 Доступ запрещён.');

    ctx.session.awaitingBanId = true;

    await ctx.reply(
      '🚫 *Блокировка пользователя*\n\nВведите Telegram ID пользователя:',
      { parse_mode: 'Markdown', ...keyboards.cancel() }
    );
  },

  /**
   * Выполнить бан
   */
  async processBan(ctx) {
    ctx.session.awaitingBanId = false;
    if (!isAuthorized(ctx)) return;

    const telegramId = parseInt(ctx.message.text?.trim());

    if (isNaN(telegramId)) {
      return ctx.reply('❌ Неверный ID. Введите числовой Telegram ID.', keyboards.adminPanel());
    }

    try {
      await userService.setBanned(telegramId, true);
      logger.info(`User ${telegramId} banned by admin ${ctx.from.id}`);

      await ctx.reply(
        `✅ Пользователь *${telegramId}* заблокирован.`,
        { parse_mode: 'Markdown', ...keyboards.adminPanel() }
      );
    } catch (error) {
      logger.error('Ban error:', error);
      await ctx.reply('❌ Ошибка при блокировке пользователя.', keyboards.adminPanel());
    }
  },
};

module.exports = adminController;
