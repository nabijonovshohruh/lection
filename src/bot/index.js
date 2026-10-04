const { Telegraf, session } = require('telegraf');
const config = require('../config');
const { ensureReady } = require('../db/ensureReady');
const pgSessionStore = require('./pgSessionStore');
const { attachUser } = require('./middlewares/attachUser.middleware');
const registerStartHandler = require('./handlers/start.handler');
const registerAdminHandler = require('./handlers/admin.handler');
const registerMentorHandler = require('./handlers/mentor.handler');
const registerStudentHandler = require('./handlers/student.handler');
const registerSharedHandler = require('./handlers/shared.handler');
const { handleFlowText, handleFlowAction } = require('./flows');

if (!config.botToken) {
  throw new Error('BOT_TOKEN is not set in .env');
}

const bot = new Telegraf(config.botToken);

bot.use(session({ store: pgSessionStore, defaultSession: () => ({}) }));
bot.use(attachUser);

registerStartHandler(bot);
registerAdminHandler(bot);
registerMentorHandler(bot);
registerStudentHandler(bot);
registerSharedHandler(bot);

// Admin/mentor ko'p bosqichli buyruqlari (masalan /newcourse, /warn) uchun
// bosqichma-bosqich davom ettiruvchi umumiy dispatcher
bot.on('text', (ctx, next) => handleFlowText(ctx, next));
bot.on('callback_query', (ctx, next) => handleFlowAction(ctx, next));

// Railway kabi platformalarda deploy paytida eski va yangi konteyner bir lahza
// ustma-ust tushib qolishi mumkin — ikkisi bir xil token bilan getUpdates
// so'rasa, Telegram 409 (Conflict) qaytaradi. Shu holatda darhol yiqilib,
// qayta-qayta urinib (restart policy orqali) muammoni yomonlashtirish o'rniga,
// bir necha soniya kutib qayta urinamiz.
async function launchWithRetry(launchFn, { retries = 5, delayMs = 3000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await launchFn();
    } catch (err) {
      const isConflict = err?.response?.error_code === 409 || /conflict/i.test(err?.message || '');
      if (!isConflict || attempt === retries) throw err;

      console.warn(
        `[bot] 409 Conflict (eski ulanish hali yopilmagan), ${attempt}/${retries}-urinish, ${delayMs}ms kutib qayta urinamiz...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

ensureReady()
  .then(() =>
    launchWithRetry(() =>
      config.webhookDomain
        ? bot.launch({ webhook: { domain: config.webhookDomain, port: config.port } })
        : bot.launch()
    )
  )
  .then(() => {
    console.log(
      config.webhookDomain
        ? `Telegram bot started in webhook mode @ ${config.webhookDomain}`
        : 'Telegram bot started in long-polling mode'
    );
  })
  .catch((err) => {
    console.error('Bot failed to start:', err);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
