/**
 * /src/database/seed.js
 * Заполняет БД тестовыми данными
 */

require('dotenv').config();
const { query, connectDB } = require('./db');
const logger = require('../utils/logger');

async function seed() {
  await connectDB();
  logger.info('🌱 Заполнение тестовыми данными...');

  // Пример тестового пользователя (замените telegram_id на свой)
  await query(`
    INSERT INTO users (telegram_id, username, first_name, is_admin)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (telegram_id) DO NOTHING
  `, [123456789, 'testadmin', 'Admin', true]);

  logger.info('✅ Seed выполнен');
  process.exit(0);
}

seed().catch(err => {
  logger.error('Ошибка seed:', err);
  process.exit(1);
});
