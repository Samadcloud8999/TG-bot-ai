/**
 * /src/database/migrate.js
 * Создаёт все таблицы в БД — запускать один раз: npm run migrate
 */

require('dotenv').config();
const { query, connectDB } = require('./db');
const logger = require('../utils/logger');

const migrations = [
  // ── Таблица пользователей ──────────────────────
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    is_premium BOOLEAN DEFAULT false,
    is_banned BOOLEAN DEFAULT false,
    is_admin BOOLEAN DEFAULT false,
    daily_requests_used INTEGER DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // ── Таблица сессий / JWT ────────────────────────
  `CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // ── История сообщений ───────────────────────────
  `CREATE TABLE IF NOT EXISTS message_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,  -- 'user' | 'assistant'
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'chat',  -- 'chat'|'notes'|'quiz'|'explain'
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // ── Конспекты ────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    topic VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // ── Тесты / викторины ────────────────────────────
  `CREATE TABLE IF NOT EXISTS quizzes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    topic VARCHAR(255) NOT NULL,
    questions JSONB NOT NULL,
    score INTEGER,
    total_questions INTEGER,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // ── Логи действий (аудит) ────────────────────────
  `CREATE TABLE IF NOT EXISTS action_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // ── Индексы для производительности ──────────────
  `CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)`,
  `CREATE INDEX IF NOT EXISTS idx_message_history_user_id ON message_history(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_message_history_created_at ON message_history(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_action_logs_user_id ON action_logs(user_id)`,
];

async function runMigrations() {
  await connectDB();
  logger.info('🔄 Запуск миграций...');

  for (let i = 0; i < migrations.length; i++) {
    try {
      await query(migrations[i]);
      logger.info(`✅ Миграция ${i + 1}/${migrations.length} выполнена`);
    } catch (error) {
      logger.error(`❌ Ошибка в миграции ${i + 1}:`, error.message);
      process.exit(1);
    }
  }

  logger.info('🎉 Все миграции выполнены успешно!');
  process.exit(0);
}

runMigrations();
