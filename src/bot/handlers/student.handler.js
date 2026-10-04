const usersService = require('../../services/users.service');
const progressService = require('../../services/progress.service');
const warningsService = require('../../services/warnings.service');

module.exports = function registerStudentHandler(bot) {
  bot.command('mycourses', async (ctx) => {
    const enrollments = await usersService.getMyEnrollments(ctx.user.id);
    const active = enrollments.filter((e) => e.status === 'active');
    if (active.length === 0) return ctx.reply('Siz hali hech qaysi kursga yozilmagansiz.');

    const lines = active.map((e) => `- ${e.course_name} (${e.group_name || 'guruhsiz'})`);
    return ctx.reply(lines.join('\n'));
  });

  bot.command('progress', async (ctx) => {
    const enrollments = await usersService.getMyEnrollments(ctx.user.id);
    const active = enrollments.filter((e) => e.status === 'active');
    if (active.length === 0) return ctx.reply('Siz hali hech qaysi kursga yozilmagansiz.');

    for (const enrollment of active) {
      const progress = await progressService.listProgressByCourse(ctx.user.id, enrollment.course_id);
      const lines = progress.map(
        (p) => `${p.order_index}. ${p.title} — ${Number(p.watch_percent).toFixed(0)}%${p.is_completed ? ' ✅' : ''}`
      );
      await ctx.reply(`${enrollment.course_name}:\n${lines.join('\n') || "Darslar yo'q"}`);
    }
  });

  bot.command('warnings', async (ctx) => {
    const warnings = await warningsService.listWarningsByUser(ctx.user.id);
    if (warnings.length === 0) return ctx.reply("Sizda ogohlantirishlar yo'q.");

    const lines = warnings.map((w) => `${w.warning_number}/${warningsService.MAX_WARNINGS} — ${w.reason}`);
    return ctx.reply(lines.join('\n'));
  });
};
