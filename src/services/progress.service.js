const pool = require('../db/pool');

const COMPLETE_THRESHOLD_PERCENT = 95;
const SEEK_BUFFER_SECONDS = 5; // player buferlashi uchun ozgina tolerantlik

async function getOrCreateProgress(userId, lessonId) {
  const existing = await pool.query(
    'SELECT * FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2',
    [userId, lessonId]
  );
  if (existing.rows[0]) return existing.rows[0];

  const { rows } = await pool.query(
    'INSERT INTO lesson_progress (user_id, lesson_id) VALUES ($1, $2) RETURNING *',
    [userId, lessonId]
  );
  return rows[0];
}

// Videoni 100% ko'rish nazorati: yangi pozitsiya avvalgi eng ko'p ko'rilgan
// joydan SEEK_BUFFER_SECONDS'dan ortiq uzoqda bo'lsa, oldinga sakrab o'tkazib
// yuborish deb hisoblanadi va rad etiladi.
//
// `ended: true` — pleer (native <video> yoki YouTube) haqiqatan "tugadi"
// hodisasini yuborganda shu flag bilan chaqiriladi. Bu holatda anti-skip
// tekshiruvi O'TKAZIB YUBORILADI: video haqiqatan oxirigacha o'ynagani
// pleerning o'zidan tasdiqlangan, bu "oldinga sakrash" emas. Buni
// tekshirmasdan qoldirish MUHIM edi — aks holda sekin internetda oxirgi
// "tugadi" so'rovi serverdagi eski max_watched_seconds'ga nisbatan
// "sakrash" deb xato rad etilib, xato .catch(()=>{}) bilan jim yutilib,
// dars hech qachon "tugatildi" deb belgilanmay qolardi (keyingi darsni
// abadiy qulflangan holda qoldirardi).
async function updateWatchPosition(userId, lessonId, positionSeconds, { ended = false } = {}) {
  const lessonRes = await pool.query('SELECT duration_seconds FROM lessons WHERE id = $1', [lessonId]);
  const lesson = lessonRes.rows[0];
  if (!lesson) throw new Error('Lesson not found');

  const progress = await getOrCreateProgress(userId, lessonId);
  const requestedPosition = Math.max(0, Math.floor(positionSeconds));

  if (!ended && requestedPosition > progress.max_watched_seconds + SEEK_BUFFER_SECONDS) {
    throw Object.assign(new Error("Videoni o'tkazib yuborish mumkin emas"), { status: 400 });
  }

  const newMax = Math.max(progress.max_watched_seconds, requestedPosition);
  const duration = lesson.duration_seconds || 1;
  const watchPercent = ended ? 100 : Math.min(100, (newMax / duration) * 100);
  const isCompleted = ended || watchPercent >= COMPLETE_THRESHOLD_PERCENT;

  const { rows } = await pool.query(
    `UPDATE lesson_progress
     SET max_watched_seconds = $1,
         watch_percent = $2,
         is_completed = $3,
         completed_at = CASE WHEN $3 AND completed_at IS NULL THEN now() ELSE completed_at END,
         last_watched_at = now(),
         updated_at = now()
     WHERE user_id = $4 AND lesson_id = $5
     RETURNING *`,
    [newMax, watchPercent.toFixed(2), isCompleted, userId, lessonId]
  );

  return rows[0];
}

async function listProgressByCourse(userId, courseId) {
  const { rows } = await pool.query(
    `SELECT l.id AS lesson_id, l.title, l.order_index, l.duration_seconds, l.type,
            COALESCE(lp.watch_percent, 0) AS watch_percent,
            COALESCE(lp.is_completed, FALSE) AS is_completed
     FROM lessons l
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
     WHERE l.course_id = $2
     ORDER BY l.order_index`,
    [userId, courseId]
  );
  return rows;
}

// Ketma-ket qulflash: SEMINAR/REVIEW darslari hech qachon qulflanmaydi
// (ularda tomosha qilib "tugatish" degan narsa yo'q). LECTURE darslari esa
// faqat o'zidan OLDINGI eng yaqin LECTURE tugatilgach ochiladi. Birinchi
// LECTURE har doim ochiq. `rows` l.order_index bo'yicha saralangan bo'lishi shart.
function computeLessonUnlockMap(rows) {
  const unlockMap = new Map();
  let previousLectureCompleted = true;

  for (const row of rows) {
    const unlocked = row.type !== 'lecture' || previousLectureCompleted;
    unlockMap.set(row.lesson_id, unlocked);

    if (row.type === 'lecture') {
      previousLectureCompleted = row.is_completed;
    }
  }

  return unlockMap;
}

async function isLessonUnlockedForUser(userId, lesson) {
  const rows = await listProgressByCourse(userId, lesson.course_id);
  const unlockMap = computeLessonUnlockMap(rows);
  return unlockMap.get(lesson.id) ?? true;
}

// Faqat LECTURE darslari video orqali "bajarildi" deb belgilanishi mumkin —
// seminar/takrorlash kunlari maxrajga qo'shilsa, 100% o'zlashtirish hech qachon
// yetib bo'lmas qiymatga aylanib qoladi.
async function listCourseProgressForMentor(courseId) {
  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.full_name,
            COUNT(l.id) AS total_lessons,
            COUNT(lp.id) FILTER (WHERE lp.is_completed) AS completed_lessons
     FROM enrollments e
     JOIN users u ON u.id = e.user_id
     JOIN lessons l ON l.course_id = e.course_id AND l.type = 'lecture'
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = u.id
     WHERE e.course_id = $1 AND e.status = 'active'
     GROUP BY u.id, u.full_name
     ORDER BY u.full_name`,
    [courseId]
  );
  return rows;
}

module.exports = {
  getOrCreateProgress,
  updateWatchPosition,
  listProgressByCourse,
  listCourseProgressForMentor,
  computeLessonUnlockMap,
  isLessonUnlockedForUser,
};
