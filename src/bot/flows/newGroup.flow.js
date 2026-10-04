const coursesService = require('../../services/courses.service');
const groupsService = require('../../services/groups.service');

const TYPE = 'admin_new_group';

async function start(ctx) {
  const courses = await coursesService.listCoursesForUser(ctx.user);
  if (courses.length === 0) {
    return ctx.reply('Avval kurs yarating: /newcourse');
  }

  ctx.session.flow = { type: TYPE, step: 1, data: {} };

  const buttons = courses.map((c) => [{ text: c.name, callback_data: `course:${c.id}` }]);
  return ctx.reply('Qaysi kurs uchun guruh yaratmoqchisiz?', {
    reply_markup: { inline_keyboard: buttons },
  });
}

async function handleAction(ctx) {
  const flow = ctx.session.flow;
  const [, courseId] = ctx.callbackQuery.data.split(':');

  if (flow.step === 1) {
    flow.data.course_id = Number(courseId);
    flow.step = 2;
    await ctx.answerCbQuery();
    return ctx.reply('Guruh nomini kiriting (masalan, "1-guruh"):');
  }
}

async function handleText(ctx) {
  const flow = ctx.session.flow;
  const text = ctx.message.text.trim();

  if (flow.step === 2) {
    flow.data.name = text;
    flow.step = 3;
    return ctx.reply("Guruh sig'imini kiriting (odatiy: 30):");
  }

  if (flow.step === 3) {
    const capacity = Number(text) || 30;
    const group = await groupsService.createGroup({
      course_id: flow.data.course_id,
      name: flow.data.name,
      capacity,
    });

    ctx.session.flow = null;
    return ctx.reply(`Guruh yaratildi: "${group.name}" (ID: ${group.id})`);
  }
}

module.exports = { TYPE, start, handleText, handleAction };
