/**
 * src/middleware/rateLimiter.js
 * Защита от спама — ограничение частоты сообщений
 */

const logger = require('../utils/logger');

// Хранилище: Map<telegramId, { count, firstRequest, warned }>
const requestMap = new Map();

const WINDOW_MS   = 10_000; // 10 секунд
const MAX_REQUESTS = 5;      // максимум 5 запросов за 10 секунд

/**
 * Очищаем устаревшие записи каждые 60 секунд
 */
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of requestMap.entries()) {
    if (now - data.firstRequest > WINDOW_MS) {
      requestMap.delete(id);
    }
  }
}, 60_000);

async function rateLimiter(ctx, next) {
  if (!ctx.from) return next();

  const userId = ctx.from.id;
  const now    = Date.now();

  let userData = requestMap.get(userId);

  if (!userData || now - userData.firstRequest > WINDOW_MS) {
    // Новое окно
    userData = { count: 1, firstRequest: now, warned: false };
    requestMap.set(userId, userData);
    return next();
  }

  userData.count++;

  if (userData.count > MAX_REQUESTS) {
    if (!userData.warned) {
      userData.warned = true;
      logger.warn(`Rate limit triggered for user ${userId}`);
      try {
        await ctx.reply(
          '⚠️ Слишком много запросов! Подождите несколько секунд перед следующим сообщением.',
        );
      } catch {}
    }
    return; // Блокируем запрос
  }

  return next();
}

module.exports = { rateLimiter };
