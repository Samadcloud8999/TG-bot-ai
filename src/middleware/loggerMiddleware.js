/**
 * src/middleware/loggerMiddleware.js
 * Логирование всех входящих событий Telegram
 */

const logger = require('../utils/logger');

async function loggerMiddleware(ctx, next) {
  const start = Date.now();
  const type  = ctx.updateType || 'unknown';
  const userId = ctx.from?.id || 'anon';

  let detail = '';
  if (ctx.message?.text)         detail = `text: "${ctx.message.text.slice(0, 50)}"`;
  else if (ctx.callbackQuery)    detail = `callback: "${ctx.callbackQuery.data}"`;
  else if (ctx.message?.photo)   detail = 'photo';

  await next();

  const ms = Date.now() - start;
  logger.info(`[${type}] user=${userId} ${detail} (${ms}ms)`);
}

module.exports = { loggerMiddleware };
