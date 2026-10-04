const coursesService = require('../../services/courses.service');
const lessonsService = require('../../services/lessons.service');

const TYPE = 'admin_new_lesson';

async function start(ctx) {
  const courses = await coursesService.listCoursesForUser(ctx.user);
  if (courses.length === 0) {
    return ctx.reply('Avval kurs yarating: /newcourse');
  }

  ctx.session.flow = { type: TYPE, step: 1, data: {} };

  const buttons = courses.map((c) => [{ text: c.name, callback_data: `course:${c.id}` }]);
  return ctx.reply("Qaysi kursga dars qo'shmoqchisiz?", {
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
    return ctx.reply('Dars nomini kiriting:');
  }
}

async function handleText(ctx) {
  const flow = ctx.session.flow;
  const text = ctx.message.text.trim();

  if (flow.step === 2) {
    flow.data.title = text;
    flow.step = 3;
    return ctx.reply('Video havolasini kiriting (URL):');
  }

  if (flow.step === 3) {
    flow.data.video_url = text;
    flow.step = 4;
    return ctx.reply('Video davomiyligini daqiqalarda kiriting (masalan, 45):');
  }

  if (flow.step === 4) {
    flow.data.duration_seconds = (Number(text) || 0) * 60;
    flow.step = 5;
    return ctx.reply('Topshiriq matnini kiriting yoki "-" deb yozing:');
  }

  if (flow.step === 5) {
    flow.data.homework_text = text === '-' ? null : text;
    flow.step = 6;
    return ctx.reply("Qo'shimcha material (PDF/resurs) havolasi bo'lsa kiriting, bo'lmasa \"-\" deb yozing:");
  }

  if (flow.step === 6) {
    flow.data.resource_url = text === '-' ? null : text;
    flow.step = 7;
    return ctx.reply("Darsni hoziroq e'lon qilasizmi? (ha/yo'q)");
  }

  if (flow.step === 7) {
    const isPublished = /^ha$/i.test(text);
    const existing = await lessonsService.listLessonsByCourse(flow.data.course_id);
    const orderIndex = existing.length + 1;

    const lesson = await lessonsService.createLesson({
      course_id: flow.data.course_id,
      title: flow.data.title,
      video_url: flow.data.video_url,
      resource_url: flow.data.resource_url,
      duration_seconds: flow.data.duration_seconds,
      homework_text: flow.data.homework_text,
      order_index: orderIndex,
      is_published: isPublished,
    });

    ctx.session.flow = null;
    return ctx.reply(
      `Dars yaratildi: "${lesson.title}" (${orderIndex}-dars, ID: ${lesson.id})${
        isPublished ? '' : " — hali e'lon qilinmagan, /publish " + lesson.id
      }`
    );
  }
}

module.exports = { TYPE, start, handleText, handleAction };
