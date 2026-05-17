/**
 * src/services/jwtService.js
 * JWT токены для сессий
 */

const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');

const SECRET  = process.env.JWT_SECRET || 'change_this_secret_in_production';
const EXPIRES = '7d';

const jwtService = {
  /**
   * Создать и сохранить JWT для пользователя
   */
  async createSession(userId) {
    const token = jwt.sign({ userId, createdAt: Date.now() }, SECRET, { expiresIn: EXPIRES });

    await query(
      `INSERT INTO sessions (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [userId, token]
    );

    return token;
  },

  /**
   * Верифицировать токен
   */
  verify(token) {
    try {
      return jwt.verify(token, SECRET);
    } catch {
      return null;
    }
  },

  /**
   * Удалить все сессии пользователя (logout)
   */
  async destroySessions(userId) {
    await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  },

  /**
   * Очистить просроченные сессии
   */
  async cleanExpired() {
    await query('DELETE FROM sessions WHERE expires_at < NOW()');
  },
};

module.exports = jwtService;
