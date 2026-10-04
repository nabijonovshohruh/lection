const pool = require('../db/pool');
const { sendTelegramMessage } = require('./notify.service');
const usersService = require('./users.service');

const MAX_WARNINGS = 4;

async function listWarningsByUser(userId, courseId) {
  const query = courseId
    ? 'SELECT * FROM warnings WHERE user_id = $1 AND course_id = $2 ORDER BY created_at DESC'
    : 'SELECT * FROM warnings WHERE user_id = $1 ORDER BY created_at DESC';
  const params = courseId ? [userId, courseId] : [userId];
  const { rows } = await pool.query(query, params);
  return rows;
}

// warning_number va 4-chi warning'da enrollment'ni "removed" qilish DB trigger'lari
// (src/db/migrations/010_create_triggers.sql) orqali avtomatik bajariladi.
async function createWarning({ user_id, course_id, lesson_id, reason, issued_by }) {
  const { rows } = await pool.query(
    `INSERT INTO warnings (user_id, course_id, lesson_id, reason, issued_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [user_id, course_id, lesson_id || null, reason, issued_by || null]
  );
  const warning = rows[0];

  const student = await usersService.findById(user_id);
  if (student) {
    const remaining = MAX_WARNINGS - warning.warning_number;
    const text =
      warning.warning_number >= MAX_WARNINGS
        ? `Sizga ${MAX_WARNINGS}-ogohlantirish berildi. Sabab: ${reason}\nAfsuski, siz kursdan chetlatildingiz.`
        : `Sizga ogohlantirish berildi (${warning.warning_number}/${MAX_WARNINGS}). Sabab: ${reason}\nYana ${remaining} ta ogohlantirishdan so'ng kursdan chetlatilasiz.`;
    await sendTelegramMessage(student.telegram_id, text);
  }

  return warning;
}

module.exports = { listWarningsByUser, createWarning, MAX_WARNINGS };
