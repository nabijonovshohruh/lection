const homeworkService = require('../../services/homework.service');

const TYPE = 'review_homework';

async function start(ctx) {
  const pending = await homeworkService.listPendingForMentor(ctx.user.id);

  if (pending.length === 0) {
    return ctx.reply("Hozircha ko'rib chiqilmagan uy vazifalari yo'q.");
  }

  ctx.session.flow = { type: TYPE, step: 1, data: {} };

  const buttons = pending.map((s) => [
    { text: `${s.student_name} — ${s.lesson_title}`, callback_data: `submission:${s.id}` },
  ]);
  return ctx.reply("Qaysi topshiriqni ko'rib chiqmoqchisiz?", {
    reply_markup: { inline_keyboard: buttons },
  });
}

async function handleAction(ctx) {
  const flow = ctx.session.flow;
  const [, submissionId] = ctx.callbackQuery.data.split(':');

  if (flow.step === 1) {
    const pending = await homeworkService.listPendingForMentor(ctx.user.id);
    const submission = pending.find((s) => String(s.id) === submissionId);

    if (!submission) {
      await ctx.answerCbQuery();
      return ctx.reply("Topshiriq topilmadi (balki allaqachon ko'rib chiqilgan).");
    }

    flow.data.submission_id = Number(submissionId);
    flow.step = 2;
    await ctx.answerCbQuery();

    return ctx.reply(
      `${submission.student_name} — "${submission.lesson_title}"\n\n${
        submission.content || '(matn kiritilmagan)'
      }\n\nTasdiqlaysizmi? (ha/yo'q)`
    );
  }
}

async function handleText(ctx) {
  const flow = ctx.session.flow;
  const text = ctx.message.text.trim();

  if (flow.step === 2) {
    if (/^ha$/i.test(text)) {
      await homeworkService.reviewSubmission(flow.data.submission_id, {
        status: 'approved',
        reviewed_by: ctx.user.id,
      });
      ctx.session.flow = null;
      return ctx.reply('Tasdiqlandi ✅');
    }

    flow.step = 3;
    return ctx.reply('Qaytarish sababini yozing:');
  }

  if (flow.step === 3) {
    await homeworkService.reviewSubmission(flow.data.submission_id, {
      status: 'rejected',
      mentor_comment: text,
      reviewed_by: ctx.user.id,
    });
    ctx.session.flow = null;
    return ctx.reply('Qaytarildi.');
  }
}

module.exports = { TYPE, start, handleText, handleAction };
