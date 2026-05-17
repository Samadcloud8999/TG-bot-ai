/**
 * /src/database/db.js
 * Подключение к PostgreSQL через пул соединений
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

// Создаём пул соединений
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 20,              // максимум соединений в пуле
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Логируем ошибки пула
pool.on('error', (err) => {
  logger.error('Непредвиденная ошибка пула PostgreSQL:', err);
});

/**
 * Проверяем подключение к БД
 */
async function connectDB() {
  const client = await pool.connect();
  try {
    await client.query('SELECT NOW()');
    logger.info('✅ PostgreSQL подключён успешно');
  } finally {
    client.release();
  }
}

/**
 * Выполнить SQL-запрос
 * @param {string} text - SQL строка
 * @param {Array} params - параметры
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug(`SQL запрос выполнен за ${duration}ms: ${text.substring(0, 80)}`);
    return res;
  } catch (error) {
    logger.error('Ошибка SQL запроса:', { text, error: error.message });
    throw error;
  }
}

/**
 * Получить клиент для транзакции
 */
async function getClient() {
  return await pool.connect();
}

module.exports = { connectDB, query, getClient, pool };
