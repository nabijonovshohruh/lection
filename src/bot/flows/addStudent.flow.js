const coursesService = require('../../services/courses.service');
const groupsService = require('../../services/groups.service');
const usersService = require('../../services/users.service');

const TYPE = 'add_student';

async function start(ctx) {
  let groups;

  if (ctx.user.role === 'admin') {
    const courses = await coursesService.listCoursesForUser(ctx.user);
    groups = [];
    for (const course of courses) {
      const courseGroups = await groupsService.listGroupsByCourse(course.id);
      courseGroups.forEach((g) => groups.push({ ...g, course_name: course.name }));
    }
  } else {
    groups = await groupsService.listGroupsForMentor(ctx.user.id);
  }

  if (groups.length === 0) {
    return ctx.reply("Sizda hali guruh yo'q.");
  }

  ctx.session.flow = { type: TYPE, step: 1, data: {} };

  const buttons = groups.map((g) => [
    { text: `${g.course_name || ''} — ${g.name}`.trim(), callback_data: `group:${g.id}` },
  ]);
  return ctx.reply("Qaysi guruhga o'quvchi qo'shmoqchisiz?", {
    reply_markup: { inline_keyboard: buttons },
  });
}

async function handleAction(ctx) {
  const flow = ctx.session.flow;
  const [, groupId] = ctx.callbackQuery.data.split(':');

  if (flow.step === 1) {
    const group = await groupsService.getGroupById(Number(groupId));

    if (ctx.user.role === 'mentor' && group.mentor_id !== ctx.user.id) {
      await ctx.answerCbQuery();
      return ctx.reply('Bu guruh sizga tegishli emas.');
    }

    flow.data.group_id = Number(groupId);
    flow.step = 2;
    await ctx.answerCbQuery();
    return ctx.reply(
      "O'quvchining Telegram ID raqamini kiriting (o'quvchi avval botda /start bosgan bo'lishi kerak):"
    );
  }
}

async function handleText(ctx) {
  const flow = ctx.session.flow;
  const text = ctx.message.text.trim();

  if (flow.step === 2) {
    const student = await usersService.findByTelegramId(text);

    if (!student) {
      return ctx.reply("Bu Telegram ID bo'yicha foydalanuvchi topilmadi. O'quvchi avval botda /start bosishi kerak.");
    }

    try {
      await groupsService.addStudentToGroup(flow.data.group_id, student.id);
      ctx.session.flow = null;
      return ctx.reply(`${student.full_name} guruhga qo'shildi.`);
    } catch (err) {
      ctx.session.flow = null;
      return ctx.reply(`Xatolik: ${err.message}`);
    }
  }
}

module.exports = { TYPE, start, handleText, handleAction };
