/**
 * src/controllers/historyController.js
 * История сообщений пользователя
 */

const historyService = require('../services/historyService');
const keyboards      = require('../utils/keyboards');
const { truncate, formatDate } = require('../utils/helpers');

const PER_PAGE = 5;

const historyController = {
  /**
   * Показать историю (страница 1)
   */
  async showHistory(ctx) {
    if (ctx.callbackQuery) await ctx.answerCbQuery();
    await historyController.showHistoryPage(ctx, 1);
  },

  /**
   * Показать конкретную страницу истории
   */
  async showHistoryPage(ctx, forcePage) {
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    const user = ctx.dbUser;
    let page = forcePage;

    if (!page) {
      // Извлекаем номер страницы из callback_data
      const match = ctx.callbackQuery?.data?.match(/^history_page_(\d+)$/);
      page = match ? parseInt(match[1]) : 1;
    }

    const { rows, total, totalPages } = await historyService.getPaginated(user.id, page, PER_PAGE);

    if (total === 0) {
      const text = '📚 *История сообщений*\n\n_История пуста. Начни общаться с AI!_';
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboards.backToMenu() });
      } catch {
        await ctx.reply(text, { parse_mode: 'Markdown', ...keyboards.backToMenu() });
      }
      return;
    }

    let text = `📚 *История сообщений* (${total} всего)\n\n`;

    for (const msg of rows) {
      const roleIcon = msg.role === 'user' ? '👤' : '🤖';
      const typeTag  = msg.type !== 'chat' ? ` [${msg.type}]` : '';
      const date     = formatDate(msg.created_at);
      text += `${roleIcon}${typeTag} _${date}_\n${truncate(msg.content, 150)}\n\n`;
    }

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboards.historyMenu(page, totalPages),
      });
    } catch {
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...keyboards.historyMenu(page, totalPages),
      });
    }
  },

  /**
   * Очистить историю
   */
  async clearHistory(ctx) {
    await ctx.answerCbQuery();

    await historyService.clear(ctx.dbUser.id);

    await ctx.editMessageText(
      '🗑 *История очищена!*\n\nВсе ваши сообщения удалены.',
      { parse_mode: 'Markdown', ...keyboards.backToMenu() }
    );
  },
};

module.exports = historyController;
