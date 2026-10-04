require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  botToken: process.env.BOT_TOKEN,
  webAppUrl: process.env.WEBAPP_URL,
  adminTelegramId: process.env.ADMIN_TELEGRAM_ID,
  // Sozlansa, bot getUpdates polling o'rniga webhook rejimida ishlaydi (masalan,
  // Railway'dagi bot service'ning public domeni, https:// prefiksisiz yoki bilan).
  webhookDomain: process.env.WEBHOOK_DOMAIN,
};
