/**
 * src/controllers/notesController.js
 * Управление конспектами
 */

const keyboards = require('../utils/keyboards');
const { query } = require('../database/connection');
const { formatDate, truncate } = require('../utils/helpers');

const notesController = {
  /**
   * /notes — показать список конспектов
   */
  async handleNotes(ctx) {
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    const user = ctx.dbUser;
    const result = await query(
      `SELECT id, title, created_at FROM notes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [user.id]
    );

    if (result.rows.length === 0) {
      await ctx.reply(
        '📝 *Мои конспекты*\n\n_У вас ещё нет конспектов._\n\nСоздай первый через AI → Написать конспект!',
        { parse_mode: 'Markdown', ...keyboards.aiMenu() }
      );
      return;
    }

    let text = `📝 *Мои конспекты* (${result.rows.length} шт.):\n\n`;
    for (const note of result.rows) {
      text += `• ${note.title} — _${formatDate(note.created_at)}_\n`;
    }
    text += '\n_Используй AI для создания новых конспектов_';

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      ...keyboards.aiMenu(),
    });
  },

  /**
   * Показать меню конспектов
   */
  async showNotesMenu(ctx) {
    if (ctx.callbackQuery) await ctx.answerCbQuery();
    await notesController.handleNotes(ctx);
  },

  /**
   * /quiz — запросить создание квиза
   */
  async handleQuizRequest(ctx) {
    ctx.session = ctx.session || {};
    ctx.session.awaitingQuizTopic = true;

    await ctx.reply(
      '🧪 *Создать тест*\n\nНапиши тему для теста:',
      { parse_mode: 'Markdown', ...keyboards.cancel() }
    );
  },
};

module.exports = notesController;
