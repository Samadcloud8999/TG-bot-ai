/**
 * src/bot.js
 */

require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const logger = require('./utils/logger');

const { rateLimiter }     = require('./middleware/rateLimiter');
const { authMiddleware }  = require('./middleware/auth');
const { loggerMiddleware }= require('./middleware/loggerMiddleware');
const { errorHandler }    = require('./middleware/errorHandler');

const startController   = require('./controllers/startController');
const profileController = require('./controllers/profileController');
const aiController      = require('./controllers/aiController');
const notesController   = require('./controllers/notesController');
const quizController    = require('./controllers/quizController');
const historyController = require('./controllers/historyController');
const adminController   = require('./controllers/adminController');
const photoController   = require('./controllers/photoController');
const userService       = require('./services/userService');

let bot;

async function startBot() {
  bot = new Telegraf(process.env.BOT_TOKEN);

  bot.use(session());
  bot.use(loggerMiddleware);
  bot.use(rateLimiter);
  bot.use(authMiddleware);

  bot.start(startController.handleStart);
  bot.help(startController.handleHelp);
  bot.command('profile',  profileController.showProfile);
  bot.command('ai',       aiController.handleAICommand);
  bot.command('notes',    notesController.handleNotes);
  bot.command('quiz',     notesController.handleQuizRequest);
  bot.command('history',  historyController.showHistory);
  bot.command('admin',    adminController.handleAdmin);
  bot.command('limits',   profileController.showLimits);

  bot.action('menu_ai',       aiController.showAIMenu);
  bot.action('menu_notes',    notesController.showNotesMenu);
  bot.action('menu_quiz',     quizController.showQuizMenu);
  bot.action('menu_profile',  profileController.showProfile);
  bot.action('menu_history',  historyController.showHistory);
  bot.action('menu_photo_notes', photoController.showPhotoNotes);
  bot.action('menu_limits',   profileController.showLimits);
  bot.action('menu_help',     startController.handleHelp);
  bot.action('menu_back',     startController.showMainMenu);

  bot.action('ai_explain',    aiController.handleExplain);
  bot.action('ai_summary',    aiController.handleSummary);
  bot.action('ai_quiz',       aiController.handleQuizGen);
  bot.action('ai_translate',  aiController.handleTranslate);
  bot.action('ai_free',       aiController.handleFreeChat);

  bot.action(/^quiz_answer_(.+)$/, quizController.handleAnswer);
  bot.action('quiz_next',          quizController.nextQuestion);
  bot.action('quiz_restart',       quizController.restartQuiz);

  bot.action('profile_upgrade', profileController.handleUpgrade);
  bot.action('profile_paid',    profileController.requestPaymentConfirmation);
  bot.action('profile_stats',   profileController.showStats);

  bot.action('history_clear',           historyController.clearHistory);
  bot.action(/^history_page_(\d+)$/,    historyController.showHistoryPage);
  bot.action(/^photo_note_show_(\d+)$/, photoController.showPhotoNote);

  bot.action('admin_login',     adminController.requestAdminLogin);
  bot.action('admin_stats',     adminController.showStats);
  bot.action('admin_users',     adminController.showUsers);
  bot.action('admin_payments',  adminController.showPaymentRequests);
  bot.action('admin_broadcast', adminController.initBroadcast);
  bot.action('admin_limits',    adminController.manageLimits);
  bot.action('admin_logs',      adminController.showLogs);
  bot.action('admin_ban',       adminController.initBan);
  bot.action(/^admin_payment_(approve|reject)_(\d+)$/, adminController.handlePaymentRequestAction);

  bot.on('photo', photoController.handlePhoto);
  bot.on('pre_checkout_query', async (ctx) => {
    try {
      await ctx.answerPreCheckoutQuery(true);
    } catch (error) {
      logger.error('Pre-checkout query failed:', error);
    }
  });

  bot.on('successful_payment', async (ctx) => {
    const userId = ctx.dbUser?.id;
    if (!userId) return;

    try {
      await userService.setPlan(userId, 'premium');
      await ctx.reply(
        '✅ Оплата принята!\nВаш тариф обновлён до Premium.\nВы получили 2000 запросов в день.',
        { parse_mode: 'Markdown', ...keyboards.backToMenu() }
      );
    } catch (error) {
      logger.error('Premium upgrade failed:', error);
      await ctx.reply(
        '❌ Ошибка при обновлении тарифа после оплаты. Обратитесь к администратору.',
        { parse_mode: 'Markdown', ...keyboards.backToMenu() }
      );
    }
  });

  bot.on('text',  handleTextRouter);

  bot.catch(errorHandler);

  await bot.launch();
  logger.info('Bot started!');
}

async function handleTextRouter(ctx) {
  const s = ctx.session || {};

  if (s.awaitingAdminPassword) return adminController.verifyAdminPassword(ctx);
  if (s.awaitingExplainTopic)  return aiController.processExplain(ctx);
  if (s.awaitingSummaryText)   return aiController.processSummary(ctx);
  if (s.awaitingQuizTopic)     return aiController.processQuizGen(ctx);
  if (s.awaitingTranslate)     return aiController.processTranslate(ctx);
  if (s.awaitingBroadcast)     return adminController.processBroadcast(ctx);
  if (s.awaitingBanId)         return adminController.processBan(ctx);
  if (s.awaitingPhotoPasswordSetup) return photoController.savePhotoPassword(ctx);
  if (s.awaitingPhotoPasswordVerify) return photoController.verifyPhotoPassword(ctx);
  if (s.awaitingPaymentConfirmation) return profileController.processPaymentConfirmation(ctx);
  if (s.aiChatMode)            return aiController.processFreeChat(ctx);

  return startController.showMainMenu(ctx);
}

function getBot() { return bot; }

module.exports = { startBot, getBot };