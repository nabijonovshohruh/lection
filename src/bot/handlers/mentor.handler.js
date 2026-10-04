const { requireRole } = require('../middlewares/attachUser.middleware');
const warnStudentFlow = require('../flows/warnStudent.flow');
const reviewHomeworkFlow = require('../flows/reviewHomework.flow');
const groupsService = require('../../services/groups.service');

module.exports = function registerMentorHandler(bot) {
  bot.command('warn', requireRole('mentor'), warnStudentFlow.start);
  bot.command('homeworks', requireRole('mentor'), reviewHomeworkFlow.start);

  bot.command('mygroup', requireRole('mentor'), async (ctx) => {
    const groups = await groupsService.listGroupsForMentor(ctx.user.id);
    if (groups.length === 0) return ctx.reply('Sizga hali guruh biriktirilmagan.');

    for (const group of groups) {
      const members = await groupsService.listGroupMembers(group.id);
      const activeMembers = members.filter((m) => m.status === 'active');
      const lines = activeMembers.map((m) => `- ${m.full_name}`);

      await ctx.reply(
        `${group.course_name} — ${group.name} (${activeMembers.length}/${group.capacity})\n${
          lines.join('\n') || "O'quvchi yo'q"
        }`
      );
    }
  });
};
