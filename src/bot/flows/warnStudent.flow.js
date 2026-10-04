const groupsService = require('../../services/groups.service');
const warningsService = require('../../services/warnings.service');

const TYPE = 'warn_student';

async function start(ctx) {
  const groups = await groupsService.listGroupsForMentor(ctx.user.id);

  if (groups.length === 0) {
    return ctx.reply('Sizga hali guruh biriktirilmagan.');
  }

  const members = [];
  for (const group of groups) {
    const groupMembers = await groupsService.listGroupMembers(group.id);
    groupMembers
      .filter((m) => m.status === 'active')
      .forEach((m) => members.push({ ...m, group_id: group.id, course_id: group.course_id }));
  }

  if (members.length === 0) {
    return ctx.reply("Guruhingizda faol o'quvchi yo'q.");
  }

  ctx.session.flow = { type: TYPE, step: 1, data: {} };

  const buttons = members.map((m) => [
    { text: m.full_name, callback_data: `student:${m.id}:${m.course_id}` },
  ]);
  return ctx.reply("Qaysi o'quvchiga ogohlantirish bermoqchisiz?", {
    reply_markup: { inline_keyboard: buttons },
  });
}

async function handleAction(ctx) {
  const flow = ctx.session.flow;
  const [, userId, courseId] = ctx.callbackQuery.data.split(':');

  if (flow.step === 1) {
    flow.data.user_id = Number(userId);
    flow.data.course_id = Number(courseId);
    flow.step = 2;
    await ctx.answerCbQuery();
    return ctx.reply('Ogohlantirish sababini yozing:');
  }
}

async function handleText(ctx) {
  const flow = ctx.session.flow;
  const text = ctx.message.text.trim();

  if (flow.step === 2) {
    const warning = await warningsService.createWarning({
      user_id: flow.data.user_id,
      course_id: flow.data.course_id,
      reason: text,
      issued_by: ctx.user.id,
    });

    ctx.session.flow = null;
    return ctx.reply(`Ogohlantirish berildi (${warning.warning_number}/${warningsService.MAX_WARNINGS}).`);
  }
}

module.exports = { TYPE, start, handleText, handleAction };
