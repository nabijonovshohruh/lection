const usersService = require('../../services/users.service');
const config = require('../../config');

module.exports = function registerStartHandler(bot) {
  bot.start(async (ctx) => {
    const user = await usersService.findOrCreateByTelegramId({
      telegram_id: ctx.from.id,
      username: ctx.from.username,
      full_name: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim(),
      language_code: ctx.from.language_code,
    });

    ctx.user = user;

    const buttons =
      user.role === 'admin'
        ? [[{ text: 'Admin Panel', web_app: { url: `${config.webAppUrl}#admin` } }]]
        : [[{ text: 'Kurslarim', web_app: { url: config.webAppUrl } }]];

    await ctx.reply(`Xush kelibsiz, ${user.full_name}!`, {
      reply_markup: { inline_keyboard: buttons },
    });
  });
};
