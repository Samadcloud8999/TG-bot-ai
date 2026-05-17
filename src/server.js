/**
 * src/server.js
 * Express HTTP сервер — нужен для:
 * 1. Keep-alive пингов на Railway/Render (чтобы бот не засыпал)
 * 2. Healthcheck endpoint
 */

const express = require('express');
const cors    = require('cors');
const logger  = require('./utils/logger');

const app = express();

app.use(cors());
app.use(express.json());

// ── Healthcheck ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status:  'ok',
    service: 'EduAI Telegram Bot',
    time:    new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

async function startServer() {
  const port = process.env.PORT || 3000;
  return new Promise((resolve) => {
    app.listen(port, () => {
      logger.info(`🌐 HTTP server listening on port ${port}`);
      resolve();
    });
  });
}

module.exports = { startServer };
