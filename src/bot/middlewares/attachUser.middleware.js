const usersService = require('../../services/users.service');

async function attachUser(ctx, next) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return next();

  const user = await usersService.findByTelegramId(telegramId);
  ctx.user = user ? await usersService.ensureAdminRole(user) : null;
  return next();
}

function requireRole(...roles) {
  return (ctx, next) => {
    if (!ctx.user || !roles.includes(ctx.user.role)) {
      return ctx.reply("Sizda bu amalni bajarish uchun ruxsat yo'q.");
    }
    return next();
  };
}

module.exports = { attachUser, requireRole };
