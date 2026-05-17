/**
 * src/middleware/errorHandler.js
 * Глобальный обработчик ошибок бота
 */

const logger = require('../utils/logger');
const { query } = require('../database/connection');

async function errorHandler(error, ctx) {
  logger.error(`Bot error for update ${ctx?.update?.update_id}:`, {
    message: error.message,
    stack:   error.stack,
    user:    ctx?.from?.id,
  });

  // Сохраняем ошибку в БД
  try {
    await query(
      `INSERT INTO error_logs (user_id, error_type, message, stack, context)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        ctx?.dbUser?.id || null,
        error.constructor.name,
        error.message,
        error.stack,
        JSON.stringify({ update_id: ctx?.update?.update_id, type: ctx?.updateType }),
      ]
    );
  } catch (dbError) {
    logger.error('Failed to save error to DB:', dbError);
  }

  // Сообщаем пользователю
  try {
    await ctx?.reply(
      '❌ Произошла ошибка при обработке запроса.\n' +
      'Попробуйте снова или нажмите /start для перезапуска.'
    );
  } catch {}
}

module.exports = { errorHandler };
