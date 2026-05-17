/**
 * src/controllers/quizController.js
 * Прохождение тестов и викторин
 */

const keyboards = require('../utils/keyboards');
const { query } = require('../database/connection');
const logger = require('../utils/logger');

const quizController = {
  /**
   * Показать меню квизов
   */
  async showQuizMenu(ctx) {
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    await ctx.reply(
      '🧪 *Тесты & Викторины*\n\n' +
      'Выбери действие:',
      {
        parse_mode: 'Markdown',
        ...require('../utils/keyboards').inlineKeyboard
          ? {}
          : require('telegraf').Markup.inlineKeyboard([
              [require('telegraf').Markup.button.callback('🧪 Создать новый тест', 'ai_quiz')],
              [require('telegraf').Markup.button.callback('🔙 Главное меню',       'menu_back')],
            ]),
      }
    );
  },

  /**
   * Отправить текущий вопрос квиза
   */
  async sendQuestion(ctx) {
    const quiz = ctx.session.currentQuiz;
    if (!quiz || quiz.current >= quiz.questions.length) {
      return quizController.finishQuiz(ctx);
    }

    const question = quiz.questions[quiz.current];
    const num      = quiz.current + 1;
    const total    = quiz.questions.length;

    const text =
      `🧪 *Тест: ${quiz.topic}*\n` +
      `📊 Вопрос ${num} из ${total}\n` +
      `🏆 Счёт: ${quiz.score}/${quiz.current}\n\n` +
      `❓ ${question.question}`;

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      ...keyboards.quizAnswers(question.options, quiz.current),
    });
  },

  /**
   * Обработать ответ на вопрос
   */
  async handleAnswer(ctx) {
    await ctx.answerCbQuery();

    const match = ctx.callbackQuery.data.match(/^quiz_answer_(\d+)_(\d+)$/);
    if (!match) return;

    const questionIndex = parseInt(match[1]);
    const answerIndex   = parseInt(match[2]);

    const quiz = ctx.session.currentQuiz;
    if (!quiz || quiz.current !== questionIndex) return;

    const question = quiz.questions[questionIndex];
    const isCorrect = answerIndex === question.correct;

    if (isCorrect) {
      quiz.score++;
    }

    const letters = ['A', 'B', 'C', 'D'];
    const resultText =
      (isCorrect ? '✅ *Правильно!*' : '❌ *Неправильно!*') + '\n\n' +
      `📌 Правильный ответ: *${letters[question.correct]}. ${question.options[question.correct]}*\n\n` +
      (question.explanation ? `💬 ${question.explanation}` : '');

    // Удаляем предыдущее сообщение с вопросом
    try {
      await ctx.deleteMessage();
    } catch {}

    await ctx.reply(resultText, {
      parse_mode: 'Markdown',
      ...keyboards.quizNext(),
    });

    quiz.current++;
  },

  /**
   * Следующий вопрос
   */
  async nextQuestion(ctx) {
    await ctx.answerCbQuery();

    const quiz = ctx.session.currentQuiz;
    if (!quiz) {
      return ctx.reply('Квиз не найден. Начни новый тест.', keyboards.aiMenu());
    }

    if (quiz.current >= quiz.questions.length) {
      return quizController.finishQuiz(ctx);
    }

    try {
      await ctx.deleteMessage();
    } catch {}

    await quizController.sendQuestion(ctx);
  },

  /**
   * Завершить квиз и показать результаты
   */
  async finishQuiz(ctx) {
    const quiz = ctx.session.currentQuiz;
    if (!quiz) return;

    const score   = quiz.score;
    const total   = quiz.questions.length;
    const percent = Math.round((score / total) * 100);

    let emoji;
    if (percent >= 80)      emoji = '🏆';
    else if (percent >= 60) emoji = '🎉';
    else if (percent >= 40) emoji = '📚';
    else                     emoji = '💪';

    const resultText =
      `${emoji} *Тест завершён!*\n\n` +
      `📖 Тема: ${quiz.topic}\n` +
      `📊 Результат: *${score} из ${total}* (${percent}%)\n\n` +
      progressBar(score, total) + '\n\n' +
      getResultMessage(percent);

    // Обновляем запись в БД
    if (quiz.id) {
      try {
        await query(
          `UPDATE quizzes SET score = $1, completed = TRUE WHERE id = $2`,
          [score, quiz.id]
        );
      } catch (e) {
        logger.error('Quiz update error:', e);
      }
    }

    // Очищаем сессию
    ctx.session.currentQuiz = null;

    try {
      await ctx.deleteMessage();
    } catch {}

    await ctx.reply(resultText, {
      parse_mode: 'Markdown',
      ...keyboards.quizResult(),
    });
  },

  /**
   * Перезапустить тот же квиз
   */
  async restartQuiz(ctx) {
    await ctx.answerCbQuery();

    const quiz = ctx.session.lastQuizTopic;
    if (!quiz) {
      return ctx.reply('Нет сохранённой темы. Создай новый тест!', keyboards.aiMenu());
    }

    ctx.session.awaitingQuizTopic = false;
    ctx.message = { text: quiz };
    await require('./aiController').processQuizGen(ctx);
  },
};

/**
 * Текстовый прогресс-бар
 */
function progressBar(value, max, len = 10) {
  const filled = Math.round((value / max) * len);
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

/**
 * Сообщение по результату
 */
function getResultMessage(percent) {
  if (percent >= 80) return '🌟 Отличный результат! Ты отлично знаешь эту тему!';
  if (percent >= 60) return '👍 Хорошо! Есть ещё что повторить, но прогресс отличный!';
  if (percent >= 40) return '📚 Неплохо! Стоит ещё раз изучить эту тему.';
  return '💪 Не расстраивайся! Попробуй прочитать материал ещё раз.';
}

module.exports = quizController;
