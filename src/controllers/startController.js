/**
 * src/controllers/startController.js
 * Обработка команд /start и /help, показ главного меню
 */

const keyboards  = require('../utils/keyboards');
const { getUserDisplayName } = require('../utils/helpers');

const startController = {
  /**
   * /start — приветствие и главное меню
   */
  async handleStart(ctx) {
    const user = ctx.dbUser;
    const name = getUserDisplayName(user);

    const welcomeText =
      `👋 Привет, *${name}*!\n\n` +
      `🎓 Добро пожаловать в *EduAI Bot* — твой персональный AI-помощник для обучения!\n\n` +
      `📚 *Что я умею:*\n` +
      `• 🤖 Отвечать на любые учебные вопросы\n` +
      `• 💡 Объяснять темы простыми словами\n` +
      `• 📝 Создавать конспекты из текстов\n` +
      `• 🧪 Генерировать тесты и викторины\n` +
      `• 🌍 Переводить тексты\n` +
      `• 📷 Анализировать фотографии заданий\n\n` +
      `✨ Выбери что тебя интересует:`;

    await ctx.reply(welcomeText, {
      parse_mode: 'Markdown',
      ...keyboards.mainMenu(),
    });
  },

  /**
   * /help — справка
   */
  async handleHelp(ctx) {
    const helpText =
      `📖 *Справка по командам:*\n\n` +
      `🤖 *AI Функции:*\n` +
      `• /ai — открыть меню AI помощника\n\n` +
      `📝 *Обучение:*\n` +
      `• /notes — создать конспект\n` +
      `• /quiz — пройти тест\n\n` +
      `👤 *Аккаунт:*\n` +
      `• /profile — личный кабинет\n` +
      `• /limits — посмотреть лимиты\n` +
      `• /history — история сообщений\n\n` +
      `🔧 *Прочее:*\n` +
      `• /admin — панель администратора\n` +
      `• /start — главное меню\n` +
      `• /help — эта справка\n\n` +
      `📷 *Совет:* Отправь мне фото задачи или текста — я его проанализирую!`;

    if (ctx.callbackQuery) await ctx.answerCbQuery();

    await ctx.reply(helpText, {
      parse_mode: 'Markdown',
      ...keyboards.backToMenu(),
    });
  },

  /**
   * Показать главное меню (используется как callback action)
   */
  async showMainMenu(ctx) {
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    const user = ctx.dbUser;
    const name = getUserDisplayName(user);

    const text =
      `🏠 *Главное меню*\n\n` +
      `Привет, ${name}! Что будем делать?\n\n` +
      `📊 Использовано сегодня: ${user.used_today || 0} / ${user.daily_limit || 200}`;

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboards.mainMenu(),
      });
    } catch {
      // Если нельзя редактировать — отправляем новое
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...keyboards.mainMenu(),
      });
    }
  },
};

module.exports = startController;
