/**
 * src/services/historyService.js
 * Работа с историей сообщений
 */

const { query } = require('../database/connection');

const historyService = {
  /**
   * Сохранить сообщение
   */
  async save(userId, role, content, type = 'chat') {
    await query(
      `INSERT INTO message_history (user_id, role, content, type) VALUES ($1, $2, $3, $4)`,
      [userId, role, content, type]
    );
  },

  /**
   * Получить последние N сообщений для контекста AI
   */
  async getRecent(userId, limit = 10) {
    const result = await query(
      `SELECT role, content FROM message_history
       WHERE user_id = $1 AND type = 'chat'
       ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    // Разворачиваем — последнее сообщение должно быть последним в массиве
    return result.rows.reverse();
  },

  /**
   * Получить историю для отображения (с пагинацией)
   */
  async getPaginated(userId, page = 1, perPage = 5) {
    const offset = (page - 1) * perPage;

    const [rowsRes, countRes] = await Promise.all([
      query(
        `SELECT role, content, type, created_at
         FROM message_history
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, perPage, offset]
      ),
      query('SELECT COUNT(*) FROM message_history WHERE user_id = $1', [userId]),
    ]);

    return {
      rows:       rowsRes.rows,
      total:      parseInt(countRes.rows[0].count),
      totalPages: Math.ceil(parseInt(countRes.rows[0].count) / perPage),
      page,
    };
  },

  /**
   * Очистить историю пользователя
   */
  async clear(userId) {
    await query('DELETE FROM message_history WHERE user_id = $1', [userId]);
  },
};

module.exports = historyService;
