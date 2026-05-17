/**
 * src/controllers/aiController.js
 * Основной AI-контроллер — объяснения, конспекты, квизы, переводы, чат
 */

const openaiService  = require('../services/openaiService');
const userService    = require('../services/userService');
const historyService = require('../services/historyService');
const keyboards      = require('../utils/keyboards');
const { splitMessage } = require('../utils/helpers');
const logger         = require('../utils/logger');

/**
 * Проверить лимит и уведомить пользователя если исчерпан
 */
async function checkLimit(ctx) {
  const user = ctx.dbUser;
  if (!user) return false;

  const allowed = await userService.checkAndDecrementLimit(user.id);
  if (!allowed) {
    await ctx.reply(
      `⛔ *Лимит исчерпан!*\n\n` +
      `Вы использовали все ${user.daily_limit} запросов на сегодня.\n` +
      `Лимит обновится завтра в 00:00.\n\n` +
      `💎 Хотите больше запросов? Обновитесь до *Premium*!`,
      { parse_mode: 'Markdown', ...keyboards.profileMenu() }
    );
    return false;
  }
  return true;
}

const aiController = {
  /**
   * /ai — показать AI меню
   */
  async handleAICommand(ctx) {
    await ctx.reply('🤖 *AI Помощник*\n\nВыбери что хочешь сделать:', {
      parse_mode: 'Markdown',
      ...keyboards.aiMenu(),
    });
  },

  /**
   * Callback: показать AI меню
   */
  async showAIMenu(ctx) {
    await ctx.answerCbQuery();
    try {
      await ctx.editMessageText('🤖 *AI Помощник*\n\nВыбери что хочешь сделать:', {
        parse_mode: 'Markdown',
        ...keyboards.aiMenu(),
      });
    } catch {
      await ctx.reply('🤖 *AI Помощник*\n\nВыбери что хочешь сделать:', {
        parse_mode: 'Markdown',
        ...keyboards.aiMenu(),
      });
    }
  },

  // ───────────────────────────── ОБЪЯСНЕНИЕ ─────────────────────────────

  async handleExplain(ctx) {
    await ctx.answerCbQuery();
    ctx.session = ctx.session || {};
    ctx.session.awaitingExplainTopic = true;

    await ctx.reply(
      '💡 *Объяснение темы*\n\n' +
      'Напиши тему, которую хочешь понять. Например:\n' +
      '• Квантовая механика\n' +
      '• Теорема Пифагора\n' +
      '• Фотосинтез\n' +
      '• Французская революция',
      { parse_mode: 'Markdown', ...keyboards.cancel() }
    );
  },

  async processExplain(ctx) {
    const topic = ctx.message.text;
    ctx.session.awaitingExplainTopic = false;

    if (!(await checkLimit(ctx))) return;

    const loadingMsg = await ctx.reply('⏳ Готовлю объяснение...');

    try {
      const explanation = await openaiService.explainTopic(topic);

      // Сохраняем в историю
      await historyService.save(ctx.dbUser.id, 'user',      `[Объяснение] ${topic}`, 'explain');
      await historyService.save(ctx.dbUser.id, 'assistant', explanation, 'explain');

      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

      const chunks = splitMessage(`💡 *Объяснение: ${topic}*\n\n${explanation}`);
      for (let i = 0; i < chunks.length; i++) {
        const isLast = i === chunks.length - 1;
        await ctx.reply(chunks[i], {
          parse_mode: 'Markdown',
          ...(isLast ? keyboards.aiMenu() : {}),
        });
      }
    } catch (error) {
      logger.error('Explain error:', error);
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      await ctx.reply('❌ Ошибка при генерации объяснения. Попробуй ещё раз.', keyboards.aiMenu());
    }
  },

  // ───────────────────────────── КОНСПЕКТ ───────────────────────────────

  async handleSummary(ctx) {
    await ctx.answerCbQuery();
    ctx.session = ctx.session || {};
    ctx.session.awaitingSummaryText = true;

    await ctx.reply(
      '📋 *Генерация конспекта*\n\n' +
      'Отправь текст или тему — я создам структурированный конспект.\n\n' +
      '_Можно вставить главу из учебника, лекцию или просто тему_',
      { parse_mode: 'Markdown', ...keyboards.cancel() }
    );
  },

  async processSummary(ctx) {
    const text = ctx.message.text;
    ctx.session.awaitingSummaryText = false;

    if (!(await checkLimit(ctx))) return;

    const loadingMsg = await ctx.reply('⏳ Создаю конспект...');

    try {
      const summary = await openaiService.generateSummary(text);

      // Сохраняем конспект в БД
      await require('../database/connection').query(
        `INSERT INTO notes (user_id, title, content, source_text)
         VALUES ($1, $2, $3, $4)`,
        [ctx.dbUser.id, `Конспект от ${new Date().toLocaleDateString('ru-RU')}`, summary, text.slice(0, 1000)]
      );

      await historyService.save(ctx.dbUser.id, 'user',      '[Конспект] ' + text.slice(0, 100), 'summary');
      await historyService.save(ctx.dbUser.id, 'assistant', summary, 'summary');

      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

      const chunks = splitMessage(`📋 *Конспект готов!*\n\n${summary}`);
      for (let i = 0; i < chunks.length; i++) {
        const isLast = i === chunks.length - 1;
        await ctx.reply(chunks[i], {
          parse_mode: 'Markdown',
          ...(isLast ? keyboards.aiMenu() : {}),
        });
      }
    } catch (error) {
      logger.error('Summary error:', error);
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      await ctx.reply('❌ Ошибка при создании конспекта.', keyboards.aiMenu());
    }
  },

  // ─────────────────────────── ГЕНЕРАЦИЯ ТЕСТА ──────────────────────────

  async handleQuizGen(ctx) {
    await ctx.answerCbQuery();
    ctx.session = ctx.session || {};
    ctx.session.awaitingQuizTopic = true;

    await ctx.reply(
      '🧪 *Генерация теста*\n\n' +
      'Напиши тему для теста. Например:\n' +
      '• История России XIX века\n' +
      '• Алгебра 8 класс\n' +
      '• Биология клетки',
      { parse_mode: 'Markdown', ...keyboards.cancel() }
    );
  },

  async processQuizGen(ctx) {
    const topic = ctx.message.text;
    ctx.session.awaitingQuizTopic = false;

    if (!(await checkLimit(ctx))) return;

    const loadingMsg = await ctx.reply('⏳ Генерирую тест...');

    try {
      const questions = await openaiService.generateQuiz(topic, 5);

      // Сохраняем квиз в БД
      const quizRes = await require('../database/connection').query(
        `INSERT INTO quizzes (user_id, topic, questions, total)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [ctx.dbUser.id, topic, JSON.stringify(questions), questions.length]
      );

      const quizId = quizRes.rows[0].id;

      // Сохраняем в сессию для прохождения
      ctx.session.currentQuiz = {
        id:        quizId,
        questions,
        current:   0,
        score:     0,
        topic,
      };

      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

      // Показываем первый вопрос
      await require('./quizController').sendQuestion(ctx);
    } catch (error) {
      logger.error('QuizGen error:', error);
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      await ctx.reply('❌ Ошибка при генерации теста. Попробуй другую тему.', keyboards.aiMenu());
    }
  },

  // ─────────────────────────── ПЕРЕВОД ──────────────────────────────────

  async handleTranslate(ctx) {
    await ctx.answerCbQuery();
    ctx.session = ctx.session || {};
    ctx.session.awaitingTranslate = true;

    await ctx.reply(
      '🌍 *Перевод текста*\n\n' +
      'Отправь текст для перевода.\n' +
      '_По умолчанию перевожу на английский. Можешь указать язык: "на немецкий: текст"_',
      { parse_mode: 'Markdown', ...keyboards.cancel() }
    );
  },

  async processTranslate(ctx) {
    let text = ctx.message.text;
    ctx.session.awaitingTranslate = false;

    // Определяем язык если указан
    let targetLang = 'английский';
    const match = text.match(/^на\s+(\S+):\s*/i);
    if (match) {
      targetLang = match[1];
      text = text.replace(match[0], '').trim();
    }

    if (!(await checkLimit(ctx))) return;

    const loadingMsg = await ctx.reply('⏳ Перевожу...');

    try {
      const translation = await openaiService.translateText(text, targetLang);

      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

      await ctx.reply(
        `🌍 *Перевод на ${targetLang}:*\n\n${translation}`,
        { parse_mode: 'Markdown', ...keyboards.aiMenu() }
      );
    } catch (error) {
      logger.error('Translate error:', error);
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      await ctx.reply('❌ Ошибка при переводе.', keyboards.aiMenu());
    }
  },

  // ─────────────────────────── СВОБОДНЫЙ ЧАТ ───────────────────────────

  async handleFreeChat(ctx) {
    await ctx.answerCbQuery();
    ctx.session = ctx.session || {};
    ctx.session.aiChatMode = true;

    await ctx.reply(
      '💬 *Режим свободного чата с AI*\n\n' +
      'Теперь задавай любые вопросы! Я помню контекст разговора.\n\n' +
      '_Для выхода из чата нажми кнопку ниже_',
      { parse_mode: 'Markdown', ...keyboards.backToMenu() }
    );
  },

  async processFreeChat(ctx) {
    const userMessage = ctx.message.text;

    if (!(await checkLimit(ctx))) return;

    // Получаем историю для контекста
    const history = await historyService.getRecent(ctx.dbUser.id, 10);
    history.push({ role: 'user', content: userMessage });

    const typingAction = ctx.sendChatAction('typing');

    try {
      await typingAction;
      const reply = await openaiService.chat(history);

      // Сохраняем оба сообщения
      await historyService.save(ctx.dbUser.id, 'user',      userMessage, 'chat');
      await historyService.save(ctx.dbUser.id, 'assistant', reply,       'chat');

      const chunks = splitMessage(reply);
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: 'Markdown' });
      }
    } catch (error) {
      logger.error('Free chat error:', error);
      await ctx.reply('❌ Ошибка при ответе AI. Попробуй снова.');
    }
  },
};

module.exports = aiController;
