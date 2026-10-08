const usersService = require('../../services/users.service');
const onboardingFlow = require('../flows/onboarding.flow');

module.exports = function registerStartHandler(bot) {
  bot.start(async (ctx) => {
    const existing = await usersService.findByTelegramId(ctx.from.id);

    if (!existing) {
      return onboardingFlow.start(ctx);
    }

    const user = await usersService.ensureAdminRole(existing);
    ctx.user = user;

    return onboardingFlow.sendWelcome(ctx, user);
  });
};
