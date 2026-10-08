const usersService = require('../../services/users.service');
const config = require('../../config');

const TYPE = 'onboarding';

function sendWelcome(ctx, user) {
  const buttons =
    user.role === 'admin'
      ? [[{ text: 'Admin Panel', web_app: { url: `${config.webAppUrl}#admin` } }]]
      : [[{ text: 'Kurslarim', web_app: { url: config.webAppUrl } }]];

  return ctx.reply(`Xush kelibsiz, ${user.full_name}!`, {
    reply_markup: { inline_keyboard: buttons },
  });
}

function start(ctx) {
  ctx.session.flow = { type: TYPE, step: 1, data: {} };
  return ctx.reply(
    "Assalomu alaykum! Botdan foydalanish uchun avval ro'yxatdan o'tishingiz kerak.\n\n" +
      'Ism va familiyangizni to\'liq kiriting (masalan, "Aliyev Vali"):'
  );
}

async function handleText(ctx) {
  const flow = ctx.session.flow;
  const text = ctx.message.text.trim();

  if (flow.step === 1) {
    if (text.length < 3) {
      return ctx.reply("Iltimos, to'liq ism-familiyangizni kiriting:");
    }

    const user = await usersService.findOrCreateByTelegramId({
      telegram_id: ctx.from.id,
      username: ctx.from.username,
      full_name: text,
      language_code: ctx.from.language_code,
    });

    ctx.session.flow = null;
    ctx.user = user;

    return sendWelcome(ctx, user);
  }
}

module.exports = { TYPE, start, handleText, sendWelcome };
