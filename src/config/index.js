require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  botToken: process.env.BOT_TOKEN,
  webAppUrl: process.env.WEBAPP_URL,
  adminTelegramId: process.env.ADMIN_TELEGRAM_ID,
};
