# 🎓 EduAI Telegram Bot

Полноценный образовательный AI-бот для Telegram с GPT-4, PostgreSQL и системой лимитов.

---

## 📁 Структура проекта

```
edu-ai-bot/
├── src/
│   ├── index.js                  # Точка входа
│   ├── bot.js                    # Telegraf + все обработчики
│   ├── server.js                 # Express keep-alive сервер
│   ├── controllers/
│   │   ├── startController.js    # /start, /help, главное меню
│   │   ├── aiController.js       # AI функции (объяснение, конспект, перевод, чат)
│   │   ├── quizController.js     # Тесты и викторины
│   │   ├── notesController.js    # Конспекты
│   │   ├── historyController.js  # История сообщений
│   │   ├── profileController.js  # Личный кабинет
│   │   ├── photoController.js    # Анализ фотографий
│   │   └── adminController.js    # Админ-панель
│   ├── services/
│   │   ├── openaiService.js      # Все запросы к OpenAI
│   │   ├── userService.js        # CRUD пользователей
│   │   ├── historyService.js     # История сообщений
│   │   └── jwtService.js         # JWT сессии
│   ├── middleware/
│   │   ├── auth.js               # Авто-регистрация пользователя
│   │   ├── rateLimiter.js        # Защита от спама
│   │   ├── loggerMiddleware.js   # Логирование запросов
│   │   └── errorHandler.js       # Глобальный обработчик ошибок
│   ├── database/
│   │   ├── connection.js         # PostgreSQL пул
│   │   └── migrate.js            # Авто-миграции таблиц
│   └── utils/
│       ├── keyboards.js          # Все inline-клавиатуры
│       ├── helpers.js            # Вспомогательные функции
│       └── logger.js             # Winston логгер
├── logs/                         # Файлы логов (создаётся автоматически)
├── .env.example                  # Пример переменных окружения
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Быстрый старт

### 1. Создать Telegram бота

1. Открой Telegram, найди **@BotFather**
2. Отправь `/newbot`
3. Введи имя бота: `EduAI Bot`
4. Введи username: `edu_ai_mybot` (должен заканчиваться на `bot`)
5. **Скопируй токен** — он выглядит так: `7123456789:AAHabcdef...`

### 2. Получить OpenAI API ключ

1. Зарегистрируйся на [platform.openai.com](https://platform.openai.com)
2. Перейди в **API Keys** → **Create new secret key**
3. Скопируй ключ (начинается с `sk-`)
4. Пополни баланс (минимум $5) — без этого API не работает

### 3. Создать базу данных (Supabase — бесплатно)

1. Зарегистрируйся на [supabase.com](https://supabase.com)
2. Создай новый проект
3. Зайди в **Settings → Database**
4. Скопируй **Connection string** (URI)
5. Он выглядит так:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres
   ```

### 4. Настроить переменные окружения

```bash
# Скопируй пример файла
cp .env.example .env

# Открой и заполни
nano .env
```

Заполни `.env`:
```env
BOT_TOKEN=7123456789:AAHabcdef...        # Твой токен от BotFather
OPENAI_API_KEY=sk-proj-...               # Твой OpenAI ключ
DATABASE_URL=postgresql://...            # Строка подключения Supabase
JWT_SECRET=my_super_secret_32chars_min  # Любая строка от 32 символов
ADMIN_PASSWORD=A4545Z                    # Пароль админ-панели
ADMIN_IDS=123456789                      # Твой Telegram ID (узнай у @userinfobot)
```

### 5. Установить зависимости и запустить

```bash
# Установить зависимости
npm install

# Запустить (миграции БД выполнятся автоматически)
npm start

# Для разработки (с авто-перезапуском)
npm run dev
```

---

## ☁️ Деплой 24/7 (БЕСПЛАТНО)

### Вариант 1: Railway (рекомендуется — самый простой)

1. **Зарегистрируйся** на [railway.app](https://railway.app)
2. **Создай аккаунт GitHub** (если нет) на [github.com](https://github.com)
3. **Загрузи проект на GitHub:**
   ```bash
   cd edu-ai-bot
   git init
   git add .
   git commit -m "Initial commit"
   # Создай репозиторий на GitHub и скопируй ссылку
   git remote add origin https://github.com/ВАШ_ЛОГИН/edu-ai-bot.git
   git push -u origin main
   ```
4. В Railway → **New Project → Deploy from GitHub repo**
5. Выбери свой репозиторий
6. Перейди в **Variables** и добавь все переменные из `.env`
7. Railway автоматически запустит бота!
8. **Бот будет работать 24/7** — Railway даёт $5/месяц бесплатно (хватает на 1 бота)

### Вариант 2: Render (тоже бесплатно)

1. Зарегистрируйся на [render.com](https://render.com)
2. **New → Web Service → Connect GitHub repo**
3. Настройки:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. Добавь **Environment Variables** из твоего `.env`
5. Deploy!

> ⚠️ **Важно для Render Free:** бесплатный план засыпает через 15 минут неактивности.
> Чтобы этого избежать, используй [UptimeRobot](https://uptimerobot.com):
> - Зарегистрируйся → New Monitor → HTTP(s)
> - URL: `https://твой-сервис.onrender.com/health`
> - Интервал: 5 минут
> Это будет пинговать сервер и не даст ему заснуть!

### Вариант 3: VPS (самый надёжный)

Если есть VPS (Hetzner, DigitalOcean, и т.д.):

```bash
# На сервере
git clone https://github.com/ВАШ_ЛОГИН/edu-ai-bot.git
cd edu-ai-bot
npm install
cp .env.example .env
nano .env  # заполнить переменные

# Установить PM2 для автозапуска
npm install -g pm2
pm2 start src/index.js --name "edu-bot"
pm2 startup   # автозапуск при перезагрузке сервера
pm2 save
pm2 logs edu-bot  # просмотр логов
```

---

## 🔧 Переменные окружения

| Переменная | Описание | Пример |
|---|---|---|
| `BOT_TOKEN` | Токен Telegram бота | `7123:AAH...` |
| `OPENAI_API_KEY` | Ключ OpenAI | `sk-proj-...` |
| `DATABASE_URL` | PostgreSQL строка подключения | `postgresql://...` |
| `JWT_SECRET` | Секрет для JWT (мин. 32 символа) | `my_secret_key_32` |
| `ADMIN_PASSWORD` | Пароль admin-панели | `A4545Z` |
| `ADMIN_IDS` | Telegram ID администраторов | `123456789` |
| `FREE_DAILY_LIMIT` | Лимит бесплатных пользователей | `10` |
| `PREMIUM_DAILY_LIMIT` | Лимит Premium пользователей | `100` |
| `OPENAI_MODEL` | Модель OpenAI | `gpt-4o-mini` |
| `NODE_ENV` | Среда запуска | `production` |
| `PORT` | HTTP порт | `3000` |

---

## 🛡️ Безопасность

- **Никогда не коммить `.env`** в Git — он в `.gitignore`
- **Пароль админа** хранится в `.env`, не в коде
- При вводе пароля бот **удаляет сообщение** с паролем из чата
- **Все неудачные попытки** входа логируются в БД
- Запросы к API **ограничены по скорости** (rate limiting)
- **JWT токены** для сессий с истечением срока

### Как скрывать ключи на Railway/Render:
- Используй только **Environment Variables** в настройках платформы
- Никогда не пишите ключи в коде или в README

---

## 📋 Команды бота

| Команда | Описание |
|---|---|
| `/start` | Главное меню |
| `/help` | Справка |
| `/ai` | AI Помощник |
| `/notes` | Мои конспекты |
| `/quiz` | Создать тест |
| `/profile` | Личный кабинет |
| `/limits` | Мои лимиты |
| `/history` | История сообщений |
| `/admin` | Панель администратора |

---

## 🔐 Вход в панель администратора

1. Напиши боту `/admin`
2. Введи пароль: `A4545Z`
3. Откроется панель с функциями:
   - 👥 Управление пользователями
   - 📊 Глобальная статистика
   - 📢 Рассылка всем пользователям
   - 🚫 Блокировка пользователей
   - 📋 Просмотр логов ошибок

---

## 🏗️ Масштабирование

- **База данных:** перейди на Supabase Pro или Railway PostgreSQL addon
- **Кэш:** добавь Redis для сессий (заменить in-memory session)
- **Очередь задач:** добавь Bull/BullMQ для рассылки
- **Мониторинг:** подключи Sentry для ошибок

---

## 📄 Лицензия

MIT
