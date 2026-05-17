/**
 * /src/index.js
 * Точка входа приложения — запускает бота и Express-сервер
 */

require('dotenv').config();
const { bot } = require('./bot');
const { connectDB } = require('./database/db');
const logger = require('./utils/logger');
const { startHealthServer } = require('./utils/healthServer');
const cron = require('node-cron');
const { resetDailyLimits } = require('./services/limitService');

// ──────────────────────────────────────────────
// Запуск приложения
// ──────────────────────────────────────────────
async function main() {
  try {
    logger.info('🚀 Запуск образовательного AI-бота...');

    // 1. Подключение к базе данных
    await connectDB();
    logger.info('✅ База данных подключена');

    // 2. Запуск Express health-check сервера (нужен для Railway/Render)
    startHealthServer();
    logger.info(`✅ Health-check сервер запущен на порту ${process.env.PORT || 3000}`);

    // 3. Сброс лимитов каждый день в полночь
    cron.schedule('0 0 * * *', async () => {
      await resetDailyLimits();
      logger.info('🔄 Дневные лимиты сброшены');
    });

    // 4. Запуск бота
    await bot.launch();
    logger.info('✅ Telegram-бот запущен успешно!');
    logger.info(`🤖 Бот: @${bot.botInfo?.username}`);

  } catch (error) {
    logger.error('❌ Ошибка запуска:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.once('SIGINT', () => {
  logger.info('🛑 Остановка бота (SIGINT)...');
  bot.stop('SIGINT');
  process.exit(0);
});
process.once('SIGTERM', () => {
  logger.info('🛑 Остановка бота (SIGTERM)...');
  bot.stop('SIGTERM');
  process.exit(0);
});

main();
