require('dotenv').config();
const { startBot } = require('./bot');
const { startServer } = require('./server');
const logger = require('./utils/logger');
const { connectDB } = require('./database/connection');
const { runMigrations } = require('./database/migrate');

async function main() {
  try {
    logger.info('Starting Bot...');
    await connectDB();
    try {
      await runMigrations();
    } catch(e) {
      logger.warn('Migrations skipped: ' + e.message);
    }
    await startServer();
    await startBot();
    logger.info('Bot is running!');
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

process.on('SIGINT',  () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

main();