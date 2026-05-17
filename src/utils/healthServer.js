/**
 * /src/utils/healthServer.js
 * Express сервер для health-check (Railway/Render требует открытый порт)
 */

const express = require('express');
const logger = require('./logger');

function startHealthServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.get('/', (req, res) => {
    res.json({
      status: 'ok',
      bot: 'EduBot AI',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  app.listen(PORT, () => {
    logger.info(`🌐 Health server: http://localhost:${PORT}`);
  });
}

module.exports = { startHealthServer };
