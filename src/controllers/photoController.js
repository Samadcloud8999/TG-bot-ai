/**
 * src/controllers/photoController.js
 * Обработка фотографий — анализ через OpenAI Vision
 */

const axios          = require('axios');
const openaiService  = require('../services/openaiService');
const userService    = require('../services/userService');
const historyService = require('../services/historyService');
const keyboards      = require('../utils/keyboards');
const logger         = require('../utils/logger');

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
      // Берём самое большое фото
      const photos  = ctx.message.photo;
      const photo   = photos[photos.length - 1];
      const fileId  = photo.file_id;

      // Получаем URL файла через Telegram API
      const fileLink = await ctx.telegram.getFileLink(fileId);
      const fileUrl  = fileLink.href;

      // Скачиваем изображение как Base64
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      const base64   = Buffer.from(response.data).toString('base64');

      // Определяем mime тип
      const mimeType = fileUrl.includes('.jpg') || fileUrl.includes('.jpeg')
        ? 'image/jpeg'
        : 'image/png';

      // Анализируем через OpenAI Vision
      const analysis = await openaiService.analyzePhoto(base64, mimeType);

      // Сохраняем в историю
      await historyService.save(user.id, 'user',      '[Фото отправлено]', 'photo');
      await historyService.save(user.id, 'assistant', analysis,            'photo');

      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

      await ctx.reply(
        `🖼 *Анализ изображения:*\n\n${analysis}`,
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
};

module.exports = photoController;
