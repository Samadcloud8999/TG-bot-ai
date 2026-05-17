/**
 * src/services/userService.js
 * CRUD операции с пользователями
 */

const { query } = require('../database/connection');
const logger = require('../utils/logger');

const userService = {
  /**
   * Найти пользователя по Telegram ID
   */
  async findByTelegramId(telegramId) {
    const result = await query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    return result.rows[0] || null;
  },

  /**
   * Найти или создать пользователя (upsert)
   */
  async findOrCreate(tgUser) {
    const existing = await this.findByTelegramId(tgUser.telegram_id);
    if (existing) {
      // Обновляем данные если изменились
      await query(
        `UPDATE users
         SET username = $1, first_name = $2, last_name = $3, updated_at = NOW()
         WHERE telegram_id = $4`,
        [tgUser.username, tgUser.first_name, tgUser.last_name, tgUser.telegram_id]
      );
      return { ...existing, ...tgUser };
    }

    // Создаём нового пользователя
    const adminIds = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim()));
    const isAdmin  = adminIds.includes(tgUser.telegram_id);
    const limit    = parseInt(process.env.FREE_DAILY_LIMIT) || 10;

    const result = await query(
      `INSERT INTO users
         (telegram_id, username, first_name, last_name, language_code, is_admin, daily_limit)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        tgUser.telegram_id,
        tgUser.username,
        tgUser.first_name,
        tgUser.last_name,
        tgUser.language_code || 'ru',
        isAdmin,
        limit,
      ]
    );

    logger.info(`New user registered: ${tgUser.telegram_id} (@${tgUser.username})`);
    return result.rows[0];
  },

  /**
   * Сбросить дневной счётчик если наступил новый день
   */
  async resetDailyLimitIfNeeded(user) {
    const today     = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastReset = user.last_reset
      ? new Date(user.last_reset).toISOString().split('T')[0]
      : '';

    if (lastReset !== today) {
      await query(
        `UPDATE users SET used_today = 0, last_reset = CURRENT_DATE WHERE id = $1`,
        [user.id]
      );
      user.used_today = 0;
      user.last_reset = today;
    }
    return user;
  },

  /**
   * Проверить и уменьшить лимит
   * @returns {boolean} true — если лимит не исчерпан
   */
  async checkAndDecrementLimit(userId) {
    const result = await query(
      'SELECT used_today, daily_limit FROM users WHERE id = $1',
      [userId]
    );
    const user = result.rows[0];
    if (!user) return false;

    if (user.used_today >= user.daily_limit) return false;

    await query(
      'UPDATE users SET used_today = used_today + 1 WHERE id = $1',
      [userId]
    );
    return true;
  },

  /**
   * Получить статистику пользователя
   */
  async getStats(userId) {
    const [messagesRes, notesRes, quizzesRes] = await Promise.all([
      query('SELECT COUNT(*) FROM message_history WHERE user_id = $1', [userId]),
      query('SELECT COUNT(*) FROM notes          WHERE user_id = $1', [userId]),
      query('SELECT COUNT(*) FROM quizzes        WHERE user_id = $1 AND completed = TRUE', [userId]),
    ]);
    return {
      messages: parseInt(messagesRes.rows[0].count),
      notes:    parseInt(notesRes.rows[0].count),
      quizzes:  parseInt(quizzesRes.rows[0].count),
    };
  },

  /**
   * Все пользователи (для админа)
   */
  async getAllUsers(limit = 20, offset = 0) {
    const result = await query(
      `SELECT id, telegram_id, username, first_name, plan, used_today, daily_limit,
              is_banned, created_at
       FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  },

  /**
   * Общая статистика (для админа)
   */
  async getGlobalStats() {
    const result = await query(`
      SELECT
        COUNT(*)                                              AS total_users,
        COUNT(*) FILTER (WHERE plan = 'premium')             AS premium_users,
        COUNT(*) FILTER (WHERE is_banned = TRUE)             AS banned_users,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_week,
        (SELECT COUNT(*) FROM message_history)               AS total_messages,
        (SELECT COUNT(*) FROM notes)                         AS total_notes,
        (SELECT COUNT(*) FROM quizzes)                       AS total_quizzes
      FROM users
    `);
    return result.rows[0];
  },

  /**
   * Обновить план пользователя
   */
  async setPlan(userId, plan) {
    const limit = plan === 'premium'
      ? parseInt(process.env.PREMIUM_DAILY_LIMIT) || 100
      : parseInt(process.env.FREE_DAILY_LIMIT)   || 10;

    await query(
      'UPDATE users SET plan = $1, daily_limit = $2, updated_at = NOW() WHERE id = $3',
      [plan, limit, userId]
    );
  },

  /**
   * Забанить / разбанить пользователя
   */
  async setBanned(telegramId, banned) {
    await query(
      'UPDATE users SET is_banned = $1, updated_at = NOW() WHERE telegram_id = $2',
      [banned, telegramId]
    );
  },
};

module.exports = userService;
