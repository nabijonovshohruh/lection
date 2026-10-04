const coursesService = require('../../services/courses.service');

const TYPE = 'admin_new_course';

function start(ctx) {
  ctx.session.flow = { type: TYPE, step: 1, data: {} };
  return ctx.reply('Yangi kurs nomini kiriting (masalan, "Frontend - Yanvar 2027 oqimi"):');
}

async function handleText(ctx) {
  const flow = ctx.session.flow;
  const text = ctx.message.text.trim();

  if (flow.step === 1) {
    flow.data.name = text;
    flow.step = 2;
    return ctx.reply('Boshlanish sanasini kiriting (YYYY-MM-DD) yoki "-" deb yozing:');
  }

  if (flow.step === 2) {
    flow.data.start_date = text === '-' ? null : text;
    flow.step = 3;
    return ctx.reply('Tugash sanasini kiriting (YYYY-MM-DD) yoki "-" deb yozing:');
  }

  if (flow.step === 3) {
    flow.data.end_date = text === '-' ? null : text;

    const course = await coursesService.createCourse({
      name: flow.data.name,
      start_date: flow.data.start_date,
      end_date: flow.data.end_date,
      created_by: ctx.user.id,
    });

    ctx.session.flow = null;
    return ctx.reply(`Kurs yaratildi: "${course.name}" (ID: ${course.id})`);
  }
}

module.exports = { TYPE, start, handleText };
