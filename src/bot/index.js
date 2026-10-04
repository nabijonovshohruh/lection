const { Telegraf, session } = require('telegraf');
const config = require('../config');
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

bot.launch().then(() => {
  console.log('Telegram bot started');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
