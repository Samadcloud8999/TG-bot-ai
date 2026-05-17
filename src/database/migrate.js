require('dotenv').config();
const { query, connectDB } = require('./db');
const logger = require('../utils/logger');

const migrations = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    language_code VARCHAR(10) DEFAULT 'ru',
    plan VARCHAR(20) DEFAULT 'free',
    is_premium BOOLEAN DEFAULT false,
    is_banned BOOLEAN DEFAULT false,
    is_admin BOOLEAN DEFAULT false,
    daily_limit INTEGER DEFAULT 200,
    used_today INTEGER DEFAULT 0,
    daily_requests_used INTEGER DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    last_reset DATE DEFAULT CURRENT_DATE,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS message_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'chat',
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    content TEXT NOT NULL,
    source_text TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS photo_notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    file_id TEXT NOT NULL,
    analysis TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS quizzes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    topic VARCHAR(255),
    questions JSONB NOT NULL,
    score INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS error_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    error_type VARCHAR(100),
    message TEXT,
    stack TEXT,
    context JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS payment_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    currency VARCHAR(10) DEFAULT 'RUB',
    note TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    admin_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)`,
  `CREATE INDEX IF NOT EXISTS idx_message_history_user_id ON message_history(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC)`,
];

async function runMigrations() {
  await connectDB();
  logger.info('🔄 Запуск миграций...');

  // Если таблица message_history уже есть и в ней нет поля type, добавляем его.
  try {
    const tableCheck = await query(
      `SELECT to_regclass('public.message_history') AS table_name`
    );

    if (tableCheck.rows[0] && tableCheck.rows[0].table_name) {
      const columnCheck = await query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = $1 AND column_name = 'type'`,
        ['message_history']
      );

      if (columnCheck.rows.length === 0) {
        await query(`ALTER TABLE message_history ADD COLUMN type VARCHAR(50) DEFAULT 'chat'`);
        logger.info('✅ Добавлена колонка type в message_history');
      }
    }

    const quizzesTableCheck = await query(
      `SELECT to_regclass('public.quizzes') AS table_name`
    );

    if (quizzesTableCheck.rows[0] && quizzesTableCheck.rows[0].table_name) {
      const missingColumns = await query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = $1 AND column_name IN ('score','total','completed')`,
        ['quizzes']
      );

      const columns = missingColumns.rows.map(row => row.column_name);
      if (!columns.includes('score')) {
        await query(`ALTER TABLE quizzes ADD COLUMN score INTEGER DEFAULT 0`);
        logger.info('✅ Добавлена колонка score в quizzes');
      }
      if (!columns.includes('total')) {
        await query(`ALTER TABLE quizzes ADD COLUMN total INTEGER DEFAULT 0`);
        logger.info('✅ Добавлена колонка total в quizzes');
      }
      if (!columns.includes('completed')) {
        await query(`ALTER TABLE quizzes ADD COLUMN completed BOOLEAN DEFAULT FALSE`);
        logger.info('✅ Добавлена колонка completed в quizzes');
      }
    }

    const notesTableCheck = await query(
      `SELECT to_regclass('public.notes') AS table_name`
    );

    if (notesTableCheck.rows[0] && notesTableCheck.rows[0].table_name) {
      const notesColumnCheck = await query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = $1 AND column_name = 'source_text'`,
        ['notes']
      );

      if (notesColumnCheck.rows.length === 0) {
        await query(`ALTER TABLE notes ADD COLUMN source_text TEXT`);
        logger.info('✅ Добавлена колонка source_text в notes');
      }
    }

    const usersTableCheck = await query(
      `SELECT to_regclass('public.users') AS table_name`
    );

    if (usersTableCheck.rows[0] && usersTableCheck.rows[0].table_name) {
      const passwordColumnCheck = await query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = $1 AND column_name = 'photo_password_hash'`,
        ['users']
      );

      if (passwordColumnCheck.rows.length === 0) {
        await query(`ALTER TABLE users ADD COLUMN photo_password_hash TEXT`);
        logger.info('✅ Добавлена колонка photo_password_hash в users');
      }
    }

    const photoNotesTableCheck = await query(
      `SELECT to_regclass('public.photo_notes') AS table_name`
    );
    if (!photoNotesTableCheck.rows[0].table_name) {
      await query(
        `CREATE TABLE IF NOT EXISTS photo_notes (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(500),
          file_id TEXT NOT NULL,
          analysis TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )`
      );
      logger.info('✅ Создана таблица photo_notes');
    }

    const paymentRequestsTableCheck = await query(
      `SELECT to_regclass('public.payment_requests') AS table_name`
    );
    if (!paymentRequestsTableCheck.rows[0].table_name) {
      await query(
        `CREATE TABLE IF NOT EXISTS payment_requests (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          amount INTEGER NOT NULL,
          currency VARCHAR(10) DEFAULT 'RUB',
          note TEXT,
          status VARCHAR(20) DEFAULT 'pending',
          admin_id INTEGER,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )`
      );
      logger.info('✅ Создана таблица payment_requests');
    }

    const freeLimit = parseInt(process.env.FREE_DAILY_LIMIT) || 200;
    const premiumLimit = parseInt(process.env.PREMIUM_DAILY_LIMIT) || 2000;

    await query(
      `UPDATE users SET daily_limit = $1 WHERE plan = 'free' AND daily_limit < $1`,
      [freeLimit]
    );
    await query(
      `UPDATE users SET daily_limit = $1 WHERE plan = 'premium' AND daily_limit < $1`,
      [premiumLimit]
    );
  } catch (error) {
    logger.error('❌ Ошибка проверки/добавления колонки type:', error.message);
  }

  for (let i = 0; i < migrations.length; i++) {
    try {
      await query(migrations[i]);
      logger.info(`✅ Миграция ${i + 1}/${migrations.length} выполнена`);
    } catch (error) {
      logger.error(`❌ Ошибка в миграции ${i + 1}:`, error.message);
    }
  }
  logger.info('🎉 Все миграции выполнены успешно!');
}

module.exports = { runMigrations };