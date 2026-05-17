/**
 * /src/bot.js
 * Главный файл бота — регистрирует все middleware и роуты
 */

const { Telegraf, session } = require('telegraf');
const logger = require('./utils/logger');
const { spamProtection } = require('./middleware/spamProtection');
const { sessionMiddleware } = require('./middleware/sessionMiddleware');
const { errorHandler } = require('./middleware/errorHandler');

// Роуты (обработчики команд)
const startRoute = require('./routes/startRoute');
const profileRoute = require('./routes/profileRoute');
const aiRoute = require('./routes/aiRoute');
const notesRoute = require('./routes/notesRoute');
const quizRoute = require('./routes/quizRoute');
const historyRoute = require('./routes/historyRoute');
const adminRoute = require('./routes/adminRoute');
const photoRoute = require('./routes/photoRoute');

// ──────────────────────────────────────────────
// Инициализация бота
// ──────────────────────────────────────────────
const bot = new Telegraf(process.env.BOT_TOKEN);

// ── Middleware ─────────────────────────────────
bot.use(session());               // встроенный session Telegraf
bot.use(sessionMiddleware);       // наш кастомный session (загрузка юзера из БД)
bot.use(spamProtection);          // защита от спама

// ── Роуты ──────────────────────────────────────
bot.use(startRoute);
bot.use(profileRoute);
bot.use(aiRoute);
bot.use(notesRoute);
bot.use(quizRoute);
bot.use(historyRoute);
bot.use(adminRoute);
bot.use(photoRoute);

// ── Обработчик ошибок (последний!) ────────────
bot.catch(errorHandler);

module.exports = { bot };
