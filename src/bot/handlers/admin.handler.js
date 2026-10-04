const { requireRole } = require('../middlewares/attachUser.middleware');
const newCourseFlow = require('../flows/newCourse.flow');
const newGroupFlow = require('../flows/newGroup.flow');
const assignMentorFlow = require('../flows/assignMentor.flow');
const newLessonFlow = require('../flows/newLesson.flow');
const coursesService = require('../../services/courses.service');
const lessonsService = require('../../services/lessons.service');
const config = require('../../config');

module.exports = function registerAdminHandler(bot) {
  bot.command('admin', requireRole('admin'), async (ctx) => {
    return ctx.reply('Admin panelga xush kelibsiz!', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Admin Panel', web_app: { url: `${config.webAppUrl}#admin` } }]],
      },
    });
  });

  bot.command('newcourse', requireRole('admin'), newCourseFlow.start);
  bot.command('newgroup', requireRole('admin'), newGroupFlow.start);
  bot.command('assignmentor', requireRole('admin'), assignMentorFlow.start);
  bot.command('newlesson', requireRole('admin'), newLessonFlow.start);

  bot.command('courses', requireRole('admin'), async (ctx) => {
    const courses = await coursesService.listCoursesForUser(ctx.user);
    if (courses.length === 0) return ctx.reply("Hali kurs yo'q.");

    const lines = courses.map((c) => `#${c.id} ${c.name} [${c.status}]`);
    return ctx.reply(lines.join('\n'));
  });

  bot.command('lessons', requireRole('admin'), async (ctx) => {
    const courses = await coursesService.listCoursesForUser(ctx.user);
    if (courses.length === 0) return ctx.reply("Hali kurs yo'q.");

    const buttons = courses.map((c) => [{ text: c.name, callback_data: `lessons_course:${c.id}` }]);
    return ctx.reply("Qaysi kursning darslarini ko'rmoqchisiz?", {
      reply_markup: { inline_keyboard: buttons },
    });
  });

  bot.action(/^lessons_course:(\d+)$/, requireRole('admin'), async (ctx) => {
    const courseId = Number(ctx.match[1]);
    const lessons = await lessonsService.listLessonsByCourse(courseId);
    await ctx.answerCbQuery();

    if (lessons.length === 0) return ctx.reply("Bu kursda hali dars yo'q.");

    const lines = lessons.map(
      (l) => `${l.order_index}. ${l.title} ${l.is_published ? '✅' : '🕓'} (ID: ${l.id})`
    );
    return ctx.reply(lines.join('\n'));
  });

  bot.command('publish', requireRole('admin'), async (ctx) => {
    const lessonId = ctx.message.text.split(' ')[1];
    if (!lessonId) return ctx.reply('Foydalanish: /publish <dars ID>');

    const lesson = await lessonsService.updateLesson(lessonId, { is_published: true });
    if (!lesson) return ctx.reply('Dars topilmadi.');

    return ctx.reply(`"${lesson.title}" endi e'lon qilindi.`);
  });
};
