/**
 * src/utils/keyboards.js
 * Централизованное хранилище всех inline-клавиатур
 */

const { Markup } = require('telegraf');

const keyboards = {
  /**
   * Главное меню
   */
  mainMenu: () =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback('🤖 AI Помощник',    'menu_ai'),
        Markup.button.callback('📝 Конспекты',      'menu_notes'),
      ],
      [
        Markup.button.callback('🧪 Тесты & Квизы', 'menu_quiz'),
        Markup.button.callback('📚 История',        'menu_history'),
      ],
      [
        Markup.button.callback('� Фото конспекты', 'menu_photo_notes'),
      ],
      [
        Markup.button.callback('�👤 Личный кабинет', 'menu_profile'),
        Markup.button.callback('📊 Мои лимиты',     'menu_limits'),
      ],
      [
        Markup.button.callback('❓ Помощь',         'menu_help'),
      ],
    ]),

  /**
   * AI подменю
   */
  aiMenu: () =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback('💡 Объяснить тему',      'ai_explain'),
        Markup.button.callback('📋 Написать конспект',   'ai_summary'),
      ],
      [
        Markup.button.callback('🧪 Создать тест',        'ai_quiz'),
        Markup.button.callback('🌍 Перевести текст',     'ai_translate'),
      ],
      [
        Markup.button.callback('💬 Свободный чат с AI',  'ai_free'),
      ],
      [
        Markup.button.callback('🔙 Главное меню',        'menu_back'),
      ],
    ]),

  /**
   * Варианты ответов для квиза
   */
  quizAnswers: (options, questionIndex) => {
    const letters = ['A', 'B', 'C', 'D'];
    const buttons = options.map((opt, i) =>
      Markup.button.callback(
        `${letters[i]}. ${opt}`,
        `quiz_answer_${questionIndex}_${i}`
      )
    );
    // По 2 кнопки в ряд
    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) {
      rows.push(buttons.slice(i, i + 2));
    }
    return Markup.inlineKeyboard(rows);
  },

  /**
   * После правильного/неправильного ответа
   */
  quizNext: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback('➡️ Следующий вопрос', 'quiz_next')],
      [Markup.button.callback('🔙 Главное меню',      'menu_back')],
    ]),

  /**
   * Результат квиза
   */
  quizResult: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Пройти ещё раз',   'quiz_restart')],
      [Markup.button.callback('🧪 Новая тема',        'ai_quiz')],
      [Markup.button.callback('🔙 Главное меню',      'menu_back')],
    ]),

  /**
   * Профиль пользователя
   */
  profileMenu: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback('⬆️ Улучшить план',  'profile_upgrade')],
      [Markup.button.callback('📊 Статистика',      'profile_stats')],
      [Markup.button.callback('🔙 Главное меню',    'menu_back')],
    ]),

  /**
   * История сообщений
   */
  historyMenu: (page = 1, totalPages = 1) => {
    const rows = [];
    const navRow = [];
    if (page > 1)         navRow.push(Markup.button.callback('◀️',  `history_page_${page - 1}`));
    navRow.push(Markup.button.callback(`${page}/${totalPages}`, 'noop'));
    if (page < totalPages) navRow.push(Markup.button.callback('▶️', `history_page_${page + 1}`));
    if (navRow.length) rows.push(navRow);
    rows.push([Markup.button.callback('🗑 Очистить историю', 'history_clear')]);
    rows.push([Markup.button.callback('🔙 Главное меню',     'menu_back')]);
    return Markup.inlineKeyboard(rows);
  },

  /**
   * Назад к главному меню
   */
  backToMenu: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Главное меню', 'menu_back')],
    ]),

  /**
   * Отмена ввода
   */
  cancel: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback('❌ Отмена', 'menu_back')],
    ]),

  /**
   * Админ панель
   */
  adminPanel: () =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback('👥 Пользователи',  'admin_users'),
        Markup.button.callback('📊 Статистика',    'admin_stats'),
      ],
      [
        Markup.button.callback('📢 Рассылка',      'admin_broadcast'),
        Markup.button.callback('⚙️ Лимиты',        'admin_limits'),
      ],
      [
        Markup.button.callback('� Платежи',       'admin_payments'),
        Markup.button.callback('📋 Логи',          'admin_logs'),
      ],
      [
        Markup.button.callback('🚫 Забанить',      'admin_ban'),
      ],
      [
        Markup.button.callback('🔙 Главное меню',  'menu_back'),
      ],
    ]),

  /**
   * Подтверждение действия
   */
  confirm: (yesAction, noAction = 'menu_back') =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Да', yesAction),
        Markup.button.callback('❌ Нет', noAction),
      ],
    ]),
};

module.exports = keyboards;
