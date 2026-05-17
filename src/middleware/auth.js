/**
 * src/middleware/auth.js
 * Автоматическая регистрация и загрузка пользователя при каждом запросе
 */

const userService = require('../services/userService');
const logger = require('../utils/logger');

/**
 * Middleware: регистрирует пользователя при первом входе,
 * обновляет данные и кладёт объект user в ctx
 */
async function authMiddleware(ctx, next) {
  try {
    // Если нет Telegram пользователя — пропускаем (системные события)
    if (!ctx.from) return next();

    const tgUser = ctx.from;

    // Найти или создать пользователя
    let user = await userService.findOrCreate({
      telegram_id: tgUser.id,
      username:    tgUser.username    || null,
      first_name:  tgUser.first_name  || null,
      last_name:   tgUser.last_name   || null,
      language_code: tgUser.language_code || 'ru',
    });

    // Сбрасываем дневной счётчик если наступил новый день
    user = await userService.resetDailyLimitIfNeeded(user);

    // Блокируем забаненных
    if (user.is_banned) {
      await ctx.reply('🚫 Ваш аккаунт заблокирован. Обратитесь к администратору.');
      return;
    }

    // Добавляем пользователя в контекст
    ctx.dbUser = user;

    return next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return next();
  }
}

module.exports = { authMiddleware };
