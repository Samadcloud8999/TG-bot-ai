/**
 * src/utils/helpers.js
 * Вспомогательные функции
 */

/**
 * Обрезает текст до максимальной длины и добавляет "..."
 */
function truncate(text, maxLength = 200) {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

/**
 * Форматирует дату для отображения
 */
function formatDate(date) {
  return new Date(date).toLocaleString('ru-RU', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

/**
 * Экранирует спецсимволы MarkdownV2
 */
function escapeMarkdown(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

/**
 * Разбивает длинный текст на чанки для Telegram (лимит 4096 символов)
 */
function splitMessage(text, maxLength = 4000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  return chunks;
}

/**
 * Получает имя пользователя для отображения
 */
function getUserDisplayName(user) {
  if (user.first_name) {
    return user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.first_name;
  }
  return user.username ? `@${user.username}` : `ID:${user.telegram_id}`;
}

/**
 * Форматирует план пользователя
 */
function formatPlan(plan) {
  const plans = { free: '🆓 Бесплатный', premium: '⭐ Premium' };
  return plans[plan] || plan;
}

/**
 * Создаёт прогресс-бар
 * @param {number} value  текущее значение
 * @param {number} max    максимум
 * @param {number} length длина бара
 */
function progressBar(value, max, length = 10) {
  const filled = Math.round((value / max) * length);
  const empty  = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Задержка (для rate limiting между запросами)
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Безопасный JSON.parse
 */
function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

module.exports = {
  truncate,
  formatDate,
  escapeMarkdown,
  splitMessage,
  getUserDisplayName,
  formatPlan,
  progressBar,
  sleep,
  safeJsonParse,
};
