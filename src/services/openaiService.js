const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});
const MODEL = process.env.OPENAI_MODEL || 'llama-3.1-8b-instant';
const TEMPERATURE = 0.7;

async function createChatCompletion(messages, maxTokens = 1000) {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages,
    temperature: TEMPERATURE,
    max_tokens: maxTokens,
  });

  return response.choices?.[0]?.message?.content || '';
}

async function createTextCompletion(prompt, maxTokens = 1000) {
  return createChatCompletion([{ role: 'user', content: prompt }], maxTokens);
}

function safeParseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

const openaiService = {
  async explainTopic(topic) {
    const prompt =
      `Объясни простым и понятным языком тему «${topic}».` +
      `\n\nСделай ответ структурированным и кратким, но информативным.`;

    return createTextCompletion(prompt, 1200);
  },

  async generateSummary(text) {
    const prompt =
      `Сделай краткий и понятный конспект по следующему тексту:\n\n${text}` +
      `\n\nВыведи структурированный ответ с основными идеями и заголовками.`;

    return createTextCompletion(prompt, 1200);
  },

  async generateQuiz(topic, count = 5) {
    const prompt =
      `Сгенерируй ${count} вопросов для теста по теме «${topic}».` +
      `\n\nВерни только JSON-массив, где каждый объект содержит поля:` +
      ` question, options, correct, explanation.` +
      `\n\nПоле options должно быть массивом из 4 вариантов, correct — индекс правильного варианта (0-3).`;

    const raw = await createTextCompletion(prompt, 1200);
    const parsed = safeParseJSON(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }

    return raw
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, index) => ({
        question: line,
        options: ['Вариант A', 'Вариант B', 'Вариант C', 'Вариант D'],
        correct: 0,
        explanation: '',
      }))
      .slice(0, count);
  },

  async translateText(text, targetLang = 'английский') {
    const prompt =
      `Переведи следующий текст на ${targetLang}:\n\n${text}`;

    return createTextCompletion(prompt, 1000);
  },

  async chat(history) {
    const messages = history.map(item => ({
      role: item.role,
      content: item.content,
    }));

    return createChatCompletion(messages, 1200);
  },

  async analyzePhoto(base64, mimeType) {
    const response = await openai.responses.create({
      model: MODEL,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Опиши изображение, выдели важные детали и дай понятный результат.' },
            { type: 'input_image', image_url: `data:${mimeType};base64,${base64}` },
          ],
        },
      ],
    });

    return response.output_text || '';
  },
};

module.exports = openaiService;