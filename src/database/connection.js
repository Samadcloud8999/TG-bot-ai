require('dotenv').config();
const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool;

async function connectDB() {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connected');
  } catch (err) {
    logger.warn('DB not available, running without database: ' + err.message);
    pool = null;
  }
  return pool;
}

function getPool() {
  if (!pool) throw new Error('Database not connected. Call connectDB() first.');
  return pool;
}

async function query(text, params = []) {
  try {
    return await getPool().query(text, params);
  } catch (error) {
    logger.error('DB Query Error:');
    throw error;
  }
}

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