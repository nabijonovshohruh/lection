require('dotenv').config();
const pool = require('../src/db/pool');
const config = require('../src/config');
const coursesService = require('../src/services/courses.service');
const groupsService = require('../src/services/groups.service');
const usersService = require('../src/services/users.service');
const lessonsService = require('../src/services/lessons.service');
const progressService = require('../src/services/progress.service');
const warningsService = require('../src/services/warnings.service');
const homeworkService = require('../src/services/homework.service');
const enrollmentsService = require('../src/services/enrollments.service');

// Haqiqiy Postgres'ga ulanib, asosiy biznes qoidalarni (guruh sig'imi, 4-ogohlantirish,
// videoni o'tkazib yubormaslik, uy vazifasi) tekshiradi. Yaratgan hamma test ma'lumotini
// oxirida o'chirib ketadi, shuning uchun amaldagi dev bazasida xavfsiz ishlatish mumkin.

const RUN_ID = Date.now() % 1_000_000;
const BASE_TELEGRAM_ID = 9_000_000_000_000 + RUN_ID;
const results = [];

function check(label, condition) {
  results.push({ label, pass: Boolean(condition) });
  console.log(`${condition ? '✅' : '❌'} ${label}`);
}

async function main() {
  let course = null;
  const testUserIds = [];

  try {
    course = await coursesService.createCourse({ name: `Smoke Test Course ${RUN_ID}` });

    const group = await groupsService.createGroup({
      course_id: course.id,
      name: 'Smoke Test Group',
      capacity: 2,
    });

    const studentA = await usersService.findOrCreateByTelegramId({
      telegram_id: BASE_TELEGRAM_ID + 1,
      full_name: 'Smoke Test Student A',
    });
    const studentB = await usersService.findOrCreateByTelegramId({
      telegram_id: BASE_TELEGRAM_ID + 2,
      full_name: 'Smoke Test Student B',
    });
    const studentC = await usersService.findOrCreateByTelegramId({
      telegram_id: BASE_TELEGRAM_ID + 3,
      full_name: 'Smoke Test Student C',
    });
    testUserIds.push(studentA.id, studentB.id, studentC.id);

    // 0) ADMIN_TELEGRAM_ID orqali admin rolini avtomatik aniqlash (self-heal)
    check("Yangi foydalanuvchi avval 'student' bo'lib yaratildi", studentA.role === 'student');

    const originalAdminTelegramId = config.adminTelegramId;
    try {
      config.adminTelegramId = String(studentA.telegram_id);
      const promoted = await usersService.findOrCreateByTelegramId({
        telegram_id: studentA.telegram_id,
        full_name: studentA.full_name,
      });
      check(
        "ADMIN_TELEGRAM_ID mos kelgach, mavjud foydalanuvchi qayta /start'da admin'ga yangilandi",
        promoted.role === 'admin'
      );

      const freshAdminTelegramId = BASE_TELEGRAM_ID + 9;
      config.adminTelegramId = String(freshAdminTelegramId);
      const freshAdmin = await usersService.findOrCreateByTelegramId({
        telegram_id: freshAdminTelegramId,
        full_name: 'Smoke Test Fresh Admin',
      });
      testUserIds.push(freshAdmin.id);
      check(
        "ADMIN_TELEGRAM_ID bilan mos kelgan YANGI foydalanuvchi to'g'ridan-to'g'ri admin bo'lib yaratildi",
        freshAdmin.role === 'admin'
      );

      // telegramAuth/attachUser middleware'lari aynan shu ketma-ketlikni bajaradi
      // (avval o'qish, keyin admin tekshiruvi) — asosiy xato shu yerda edi, shuning
      // uchun findOrCreateByTelegramId'ga tegmasdan to'g'ridan-to'g'ri sinaymiz.
      const middlewareTestTelegramId = BASE_TELEGRAM_ID + 10;
      const middlewareTestUser = await usersService.findOrCreateByTelegramId({
        telegram_id: middlewareTestTelegramId,
        full_name: 'Smoke Test Middleware User',
      });
      testUserIds.push(middlewareTestUser.id);
      check(
        "Middleware testi uchun foydalanuvchi avval 'student' bo'lib yaratildi",
        middlewareTestUser.role === 'student'
      );

      config.adminTelegramId = String(middlewareTestTelegramId);
      const rawUser = await usersService.findByTelegramId(middlewareTestTelegramId);
      const healedUser = await usersService.ensureAdminRole(rawUser);
      check(
        'API/bot middleware ketma-ketligi (findByTelegramId + ensureAdminRole) to\'g\'ri ishlaydi',
        healedUser.role === 'admin'
      );

      // Railway Variables'ga qiymat probel/qo'shtirnoq bilan noto'g'ri kiritilsa ham ishlashi kerak
      const quotedTelegramId = BASE_TELEGRAM_ID + 11;
      const quotedUser = await usersService.findOrCreateByTelegramId({
        telegram_id: quotedTelegramId,
        full_name: 'Smoke Test Quoted Admin',
      });
      testUserIds.push(quotedUser.id);

      config.adminTelegramId = `  "${quotedTelegramId}"  `;
      const healedQuotedUser = await usersService.ensureAdminRole(
        await usersService.findByTelegramId(quotedTelegramId)
      );
      check(
        "ADMIN_TELEGRAM_ID atrofida probel/qo'shtirnoq bo'lsa ham mos kelish aniqlanadi",
        healedQuotedUser.role === 'admin'
      );
    } finally {
      config.adminTelegramId = originalAdminTelegramId;
    }

    // 1) Guruh sig'imi (capacity trigger)
    await groupsService.addStudentToGroup(group.id, studentA.id);
    await groupsService.addStudentToGroup(group.id, studentB.id);
    check("Guruh sig'imi (2) ichida 2 talaba muvaffaqiyatli qo'shildi", true);

    let capacityRejected = false;
    try {
      await groupsService.addStudentToGroup(group.id, studentC.id);
    } catch (err) {
      capacityRejected = err.code === 'P0001';
    }
    check("3-talaba qo'shilganda guruh sig'imi trigger'i uni rad etdi", capacityRejected);

    // 2) 4 ta ogohlantirish -> avtomatik "removed"
    for (let i = 1; i <= 4; i++) {
      await warningsService.createWarning({
        user_id: studentA.id,
        course_id: course.id,
        reason: `Smoke test warning ${i}`,
      });
    }
    const { rows: enrollmentRows } = await pool.query(
      'SELECT status FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [studentA.id, course.id]
    );
    check(
      "4-ogohlantirishdan keyin enrollment avtomatik 'removed' holatiga o'tdi",
      enrollmentRows[0]?.status === 'removed'
    );

    // 3) Videoni 100% ko'rish + o'tkazib yuborishga yo'l qo'ymaslik
    const lesson = await lessonsService.createLesson({
      course_id: course.id,
      title: 'Smoke Test Lesson',
      video_url: 'https://example.com/video.mp4',
      duration_seconds: 100,
      order_index: 1,
      is_published: true,
    });

    const lessonWithResource = await lessonsService.updateLesson(lesson.id, {
      resource_url: 'https://example.com/handout.pdf',
    });
    check(
      "Darsga resource_url (PDF/material havolasi) saqlandi",
      lessonWithResource.resource_url === 'https://example.com/handout.pdf'
    );

    let pos = 0;
    while (pos < 50) {
      pos = Math.min(pos + 5, 50);
      await progressService.updateWatchPosition(studentB.id, lesson.id, pos);
    }
    check("Progress 0 -> 50s ketma-ket (5s qadamda) muvaffaqiyatli yozildi", true);

    let skipRejected = false;
    try {
      await progressService.updateWatchPosition(studentB.id, lesson.id, 200);
    } catch (err) {
      skipRejected = err.status === 400;
    }
    check("Videoni oldinga sakrab o'tkazib yuborish (50 -> 200) rad etildi", skipRejected);

    while (pos < 100) {
      pos = Math.min(pos + 5, 100);
      await progressService.updateWatchPosition(studentB.id, lesson.id, pos);
    }
    const finished = await progressService.getOrCreateProgress(studentB.id, lesson.id);
    check("100 soniyagacha ketma-ket ko'rilgach is_completed = true bo'ldi", finished.is_completed === true);

    // 4) Uy vazifasi topshirish va tasdiqlash
    const submission = await homeworkService.submitHomework({
      lesson_id: lesson.id,
      user_id: studentB.id,
      content: 'Smoke test homework javobi',
    });
    const reviewed = await homeworkService.reviewSubmission(submission.id, { status: 'approved' });
    check("Uy vazifasi topshirildi va 'approved' deb belgilandi", reviewed.status === 'approved');

    // 5) Guruhsiz kursga kirish huquqini berish/bekor qilish (admin panel funksiyasi)
    const granted = await enrollmentsService.grantAccess(studentC.id, course.id);
    check(
      "Guruhsiz kursga kirish huquqi berildi (status=active, group_id=null)",
      granted.status === 'active' && granted.group_id === null
    );

    const revoked = await enrollmentsService.revokeAccess(studentC.id, course.id);
    check("Kirish huquqi bekor qilindi (status='dropped')", revoked.status === 'dropped');

    const regranted = await enrollmentsService.grantAccess(studentC.id, course.id);
    check("Bekor qilingan kirish qayta berilganda status yana 'active' bo'ldi", regranted.status === 'active');

    const roster = await enrollmentsService.listEnrollmentsForCourse(course.id);
    check(
      'Kurs ro\'yxatida (listEnrollmentsForCourse) yozilishlar ko\'rinadi',
      roster.some((r) => r.user_id === studentC.id)
    );
  } finally {
    if (course) await coursesService.deleteCourse(course.id);
    if (testUserIds.length) {
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [testUserIds]);
    }
  }

  const failed = results.filter((r) => !r.pass);
  console.log('---');
  console.log(`${results.length - failed.length}/${results.length} tekshiruv muvaffaqiyatli`);

  if (failed.length > 0) {
    console.log('Muvaffaqiyatsiz:', failed.map((f) => f.label).join(', '));
    process.exitCode = 1;
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error('Smoke test xatolik bilan tugadi:', err);
  process.exitCode = 1;
  await pool.end();
});
