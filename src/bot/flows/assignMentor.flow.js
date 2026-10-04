const coursesService = require('../../services/courses.service');
const groupsService = require('../../services/groups.service');
const usersService = require('../../services/users.service');

const TYPE = 'admin_assign_mentor';

async function start(ctx) {
  const courses = await coursesService.listCoursesForUser(ctx.user);
  const allGroups = [];
  for (const course of courses) {
    const groups = await groupsService.listGroupsByCourse(course.id);
    groups.forEach((g) => allGroups.push({ ...g, course_name: course.name }));
  }

  if (allGroups.length === 0) {
    return ctx.reply("Hali guruh yo'q. Avval /newgroup orqali guruh yarating.");
  }

  ctx.session.flow = { type: TYPE, step: 1, data: {} };

  const buttons = allGroups.map((g) => [
    { text: `${g.course_name} — ${g.name}`, callback_data: `group:${g.id}` },
  ]);
  return ctx.reply('Qaysi guruhga mentor biriktirmoqchisiz?', {
    reply_markup: { inline_keyboard: buttons },
  });
}

async function handleAction(ctx) {
  const flow = ctx.session.flow;
  const [, groupId] = ctx.callbackQuery.data.split(':');

  if (flow.step === 1) {
    flow.data.group_id = Number(groupId);
    flow.step = 2;
    await ctx.answerCbQuery();
    return ctx.reply("Mentorning Telegram ID raqamini kiriting (mentor avval botda /start bosgan bo'lishi kerak):");
  }
}

async function handleText(ctx) {
  const flow = ctx.session.flow;
  const text = ctx.message.text.trim();

  if (flow.step === 2) {
    const mentor = await usersService.findByTelegramId(text);

    if (!mentor) {
      return ctx.reply("Bu Telegram ID bo'yicha foydalanuvchi topilmadi. Mentor avval botda /start bosishi kerak.");
    }

    const group = await groupsService.assignMentor(flow.data.group_id, mentor.id);
    ctx.session.flow = null;
    return ctx.reply(`${mentor.full_name} "${group.name}" guruhiga mentor etib biriktirildi.`);
  }
}

module.exports = { TYPE, start, handleText, handleAction };
