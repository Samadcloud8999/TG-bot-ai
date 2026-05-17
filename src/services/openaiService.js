/**
 * src/services/openaiService.js
 * Все запросы к OpenAI API
 */

const OpenAI = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL  = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const openaiService = {
  /**
   * Объяснить тему простыми словами
   */
  async explainTopic(topic) {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Ты — дружелюбный AI-репетитор. Объясняй темы максимально понятно, ' +
            'используй аналогии, примеры из жизни, структурируй ответ. ' +
            'Пиши на русском языке. Используй эмодзи для наглядности.',
        },
        {
          role: 'user',
          content: `Объясни мне простыми словами тему: "${topic}"`,
        },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    return response.choices[0].message.content;
  },

  /**
   * Сгенерировать конспект из текста
   */
  async generateSummary(text) {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Ты — эксперт по созданию образовательных конспектов. ' +
            'Создавай структурированные, информативные конспекты. ' +
            'Используй: заголовки, ключевые термины (жирным через **), ' +
            'маркированные списки, выводы. Пиши на русском языке.',
        },
        {
          role: 'user',
          content: `Создай подробный конспект по следующему материалу:\n\n${text}`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.5,
    });

    return response.choices[0].message.content;
  },

  /**
   * Сгенерировать тест/викторину по теме
   * @returns {Array} массив вопросов
   */
  async generateQuiz(topic, questionsCount = 5) {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Ты — создатель образовательных тестов. ' +
            'Генерируй ТОЛЬКО JSON массив без каких-либо пояснений. ' +
            'Формат каждого вопроса: ' +
            '{ "question": "текст вопроса", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "пояснение" } ' +
            'где correct — индекс правильного ответа (0-3).',
        },
        {
          role: 'user',
          content:
            `Создай тест из ${questionsCount} вопросов по теме: "${topic}". ` +
            'Верни только JSON массив.',
        },
      ],
      max_tokens: 2000,
      temperature: 0.8,
    });

    const raw = response.choices[0].message.content;
    // Очищаем от markdown блоков кода если есть
    const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  },

  /**
   * Перевести текст
   */
  async translateText(text, targetLang = 'английский') {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `Ты — профессиональный переводчик. Переводи точно и естественно на ${targetLang}.`,
        },
        {
          role: 'user',
          content: `Переведи следующий текст на ${targetLang}:\n\n${text}`,
        },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    return response.choices[0].message.content;
  },

  /**
   * Свободный чат с AI (с историей сообщений)
   * @param {Array} messages  массив { role, content }
   */
  async chat(messages) {
    const systemMsg = {
      role: 'system',
      content:
        'Ты — умный образовательный AI-ассистент. ' +
        'Помогаешь с учёбой, отвечаешь на вопросы, объясняешь сложные темы. ' +
        'Будь дружелюбным, точным и информативным. Пиши на русском языке.',
    };

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [systemMsg, ...messages],
      max_tokens: 1000,
      temperature: 0.7,
    });

    return response.choices[0].message.content;
  },

  /**
   * Анализ фотографии через Vision API
   */
  async analyzePhoto(imageBase64, mimeType = 'image/jpeg') {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',   // Vision требует gpt-4o
      messages: [
        {
          role: 'system',
          content:
            'Ты — образовательный AI-ассистент. Анализируй изображения в образовательном контексте: ' +
            'распознавай текст, формулы, схемы, диаграммы, объясняй что изображено. ' +
            'Пиши на русском языке. Если это задача или вопрос — помоги решить.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url:    `data:${mimeType};base64,${imageBase64}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: 'Проанализируй это изображение. Если это учебный материал, задача или вопрос — помоги с ним.',
            },
          ],
        },
      ],
      max_tokens: 1500,
    });

    return response.choices[0].message.content;
  },
};

module.exports = openaiService;
