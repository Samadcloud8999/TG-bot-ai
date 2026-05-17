/**
 * src/controllers/photoController.js
 * Обработка фотографий — анализ через OpenAI Vision
 */

const axios          = require('axios');
const bcrypt         = require('bcryptjs');
const { Markup }     = require('telegraf');
const openaiService  = require('../services/openaiService');
const userService    = require('../services/userService');
const historyService = require('../services/historyService');
const { query }      = require('../database/connection');
const keyboards      = require('../utils/keyboards');
const logger         = require('../utils/logger');
const { formatDate } = require('../utils/helpers');

function getBot() { return require('../bot').getBot(); }

const photoController = {
  /**
   * Обработать входящее фото
   */
  async handlePhoto(ctx) {
    const user = ctx.dbUser;

    // Проверяем лимит
    const allowed = await userService.checkAndDecrementLimit(user.id);
    if (!allowed) {
      await ctx.reply(
        `⛔ *Лимит исчерпан!*\nИспользовано ${user.daily_limit}/${user.daily_limit} запросов.\nОбновится завтра.`,
        { parse_mode: 'Markdown', ...keyboards.profileMenu() }
      );
      return;
    }

    const loadingMsg = await ctx.reply('🔍 Анализирую изображение...');

    try {
      const photos  = ctx.message.photo;
      const photo   = photos[photos.length - 1];
      const fileId  = photo.file_id;

      const fileLink = await ctx.telegram.getFileLink(fileId);
      const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
      const base64   = Buffer.from(response.data).toString('base64');
      const mimeType = fileLink.href.includes('.jpg') || fileLink.href.includes('.jpeg')
        ? 'image/jpeg'
        : 'image/png';

      const analysis = await openaiService.analyzePhoto(base64, mimeType);

      await historyService.save(user.id, 'user',      '[Фото отправлено]', 'photo');
      await historyService.save(user.id, 'assistant', analysis,            'photo');

      await query(
        `INSERT INTO photo_notes (user_id, title, file_id, analysis)
         VALUES ($1, $2, $3, $4)`,
        [user.id, `Фото конспект ${new Date().toLocaleDateString('ru-RU')}`, fileId, analysis]
      );

      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

      await ctx.reply(
        `🖼 *Фото-конспект сохранён!*\n\n${analysis}\n\n` +
        `Для доступа к разделу фото-конспектов нажмите кнопку «Фото конспекты» в меню.`,
        { parse_mode: 'Markdown', ...keyboards.aiMenu() }
      );
    } catch (error) {
      logger.error('Photo analysis error:', error);
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      await ctx.reply(
        '❌ Не удалось проанализировать изображение.\n' +
        '_Убедись что изображение чёткое и попробуй снова._',
        { parse_mode: 'Markdown', ...keyboards.backToMenu() }
      );
    }
  },

  async showPhotoNotes(ctx) {
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    const user = ctx.dbUser;
    const result = await query(
      'SELECT photo_password_hash FROM users WHERE id = $1',
      [user.id]
    );

    const passwordHash = result.rows[0]?.photo_password_hash;
    if (!passwordHash) {
      ctx.session = ctx.session || {};
      ctx.session.awaitingPhotoPasswordSetup = true;

      await ctx.reply(
        '🔐 *Раздел фото-конспектов защищён паролем.*\n\n' +
        'Придумайте пароль, чтобы сохранять и просматривать свои фото-конспекты.',
        { parse_mode: 'Markdown', ...keyboards.cancel() }
      );
      return;
    }

    ctx.session = ctx.session || {};
    ctx.session.awaitingPhotoPasswordVerify = true;

    await ctx.reply(
      '🔒 Введите пароль для доступа к фото-конспектам:',
      { parse_mode: 'Markdown', ...keyboards.cancel() }
    );
  },

  async savePhotoPassword(ctx) {
    const password = ctx.message.text?.trim();
    ctx.session.awaitingPhotoPasswordSetup = false;

    if (!password || password.length < 4) {
      ctx.session.awaitingPhotoPasswordSetup = true;
      return await ctx.reply(
        '❌ Пароль должен быть минимум 4 символа. Попробуйте ещё раз.',
        { parse_mode: 'Markdown', ...keyboards.cancel() }
      );
    }

    const hash = await bcrypt.hash(password, 10);
    await query(
      'UPDATE users SET photo_password_hash = $1 WHERE id = $2',
      [hash, ctx.dbUser.id]
    );

    await ctx.reply(
      '✅ Пароль сохранён. Теперь снова нажмите кнопку «Фото конспекты» для входа.',
      { parse_mode: 'Markdown', ...keyboards.backToMenu() }
    );
  },

  async verifyPhotoPassword(ctx) {
    const password = ctx.message.text?.trim();
    if (!password) {
      ctx.session.awaitingPhotoPasswordVerify = true;
      return await ctx.reply(
        '❌ Введите пароль для доступа к фото-конспектам.',
        { parse_mode: 'Markdown', ...keyboards.cancel() }
      );
    }

    const result = await query(
      'SELECT photo_password_hash FROM users WHERE id = $1',
      [ctx.dbUser.id]
    );

    const hash = result.rows[0]?.photo_password_hash;
    ctx.session.awaitingPhotoPasswordVerify = false;

    if (!hash || !(await bcrypt.compare(password, hash))) {
      ctx.session.awaitingPhotoPasswordVerify = true;
      return await ctx.reply(
        '❌ Неверный пароль. Попробуйте ещё раз.',
        { parse_mode: 'Markdown', ...keyboards.cancel() }
      );
    }

    ctx.session.photoAccessGranted = true;
    await ctx.reply(
      '✅ Пароль принят! Показываю ваши фото-конспекты.',
      { parse_mode: 'Markdown', ...keyboards.backToMenu() }
    );

    return photoController.showPhotoNotesList(ctx);
  },

  async showPhotoNotesList(ctx) {
    const result = await query(
      `SELECT id, title, created_at, file_id
       FROM photo_notes
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [ctx.dbUser.id]
    );

    if (result.rows.length === 0) {
      return await ctx.reply(
        '📷 У вас ещё нет фото-конспектов. Отправьте фото задачи или текста, и я сохраню его как фото-конспект.',
        { parse_mode: 'Markdown', ...keyboards.aiMenu() }
      );
    }

    let text = `📷 *Мои фото-конспекты* (${result.rows.length}):\n\n`;
    const buttons = [];
    for (const note of result.rows) {
      text += `• ${note.title} — _${formatDate(note.created_at)}_\n`;
      buttons.push([Markup.button.callback(`📷 ${note.title}`, `photo_note_show_${note.id}`)]);
    }
    buttons.push([Markup.button.callback('🔙 Главное меню', 'menu_back')]);

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard(buttons),
    });
  },

  async showPhotoNote(ctx) {
    if (!ctx.session?.photoAccessGranted) {
      return await ctx.reply(
        '🔒 Сначала нужно ввести пароль для доступа к фото-конспектам.',
        { parse_mode: 'Markdown', ...keyboards.backToMenu() }
      );
    }

    const noteId = parseInt(ctx.match[1], 10);
    if (isNaN(noteId)) {
      return await ctx.reply('❌ Некорректный идентификатор фото-конспекта.', keyboards.backToMenu());
    }

    const result = await query(
      `SELECT title, file_id, analysis FROM photo_notes
       WHERE id = $1 AND user_id = $2`,
      [noteId, ctx.dbUser.id]
    );

    const note = result.rows[0];
    if (!note) {
      return await ctx.reply('❌ Фото-конспект не найден.', keyboards.backToMenu());
    }

    await ctx.replyWithPhoto(note.file_id, {
      caption: `📷 *${note.title}*\n\n${note.analysis}`,
      parse_mode: 'Markdown',
      ...keyboards.backToMenu(),
    });
  },
};

module.exports = photoController;
