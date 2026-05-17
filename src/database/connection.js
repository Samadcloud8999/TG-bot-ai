/**
 * src/database/connection.js
 * Подключение к PostgreSQL через пул соединений
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool;

async function connectDB() {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Если DATABASE_URL не задан, используем отдельные переменные
    ...(process.env.DATABASE_URL
      ? {}
      : {
          host:     process.env.DB_HOST     || 'localhost',
          port:     parseInt(process.env.DB_PORT) || 5432,
          database: process.env.DB_NAME     || 'edu_bot',
          user:     process.env.DB_USER     || 'postgres',
          password: process.env.DB_PASSWORD || '',
        }),
    max: 20,              // максимум соединений в пуле
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  });

  // Проверяем соединение
  const client = await pool.connect();
  await client.query('SELECT NOW()');
  client.release();

  logger.info('📦 PostgreSQL pool created');
  return pool;
}

function getPool() {
  if (!pool) throw new Error('Database not connected. Call connectDB() first.');
  return pool;
}

/**
 * Выполнить SQL запрос
 * @param {string} text   SQL строка
 * @param {Array}  params Параметры
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await getPool().query(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      logger.warn(`Slow query (${duration}ms): ${text}`);
    }
    return result;
  } catch (error) {
    logger.error('DB Query Error:', { text, params, error: error.message });
    throw error;
  }
}

/**
 * Транзакция
 */
async function withTransaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { connectDB, getPool, query, withTransaction };
