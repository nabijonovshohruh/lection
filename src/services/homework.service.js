const pool = require('../db/pool');
const { sendTelegramMessage } = require('./notify.service');
const usersService = require('./users.service');

async function submitHomework({ lesson_id, user_id, content, file_url }) {
  const { rows } = await pool.query(
    `INSERT INTO homework_submissions (lesson_id, user_id, content, file_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (lesson_id, user_id)
     DO UPDATE SET content = EXCLUDED.content, file_url = EXCLUDED.file_url,
                    status = 'pending', mentor_comment = NULL, reviewed_by = NULL,
                    reviewed_at = NULL, submitted_at = now()
     RETURNING *`,
    [lesson_id, user_id, content || null, file_url || null]
  );
  return rows[0];
}

async function getSubmission(lessonId, userId) {
  const { rows } = await pool.query(
    'SELECT * FROM homework_submissions WHERE lesson_id = $1 AND user_id = $2',
    [lessonId, userId]
  );
  return rows[0] || null;
}

async function getSubmissionById(id) {
  const { rows } = await pool.query(
    `SELECT hs.*, l.course_id
     FROM homework_submissions hs
     JOIN lessons l ON l.id = hs.lesson_id
     WHERE hs.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function listPendingForMentor(mentorId) {
  const { rows } = await pool.query(
    `SELECT hs.*, u.full_name AS student_name, l.title AS lesson_title, l.course_id
     FROM homework_submissions hs
     JOIN users u ON u.id = hs.user_id
     JOIN lessons l ON l.id = hs.lesson_id
     JOIN enrollments e ON e.user_id = hs.user_id AND e.course_id = l.course_id
     JOIN groups g ON g.id = e.group_id
     WHERE g.mentor_id = $1 AND hs.status = 'pending'
     ORDER BY hs.submitted_at`,
    [mentorId]
  );
  return rows;
}

async function reviewSubmission(id, { status, mentor_comment, reviewed_by }) {
  const { rows } = await pool.query(
    `UPDATE homework_submissions
     SET status = $1, mentor_comment = $2, reviewed_by = $3, reviewed_at = now()
     WHERE id = $4
     RETURNING *`,
    [status, mentor_comment || null, reviewed_by, id]
  );
  const submission = rows[0];
  if (!submission) return null;

  const student = await usersService.findById(submission.user_id);
  if (student) {
    const text =
      status === 'approved'
        ? 'Uy vazifangiz qabul qilindi! ✅'
        : `Uy vazifangiz qaytarildi. Sabab: ${mentor_comment || "ko'rsatilmagan"}`;
    await sendTelegramMessage(student.telegram_id, text);
  }

  return submission;
}

module.exports = {
  submitHomework,
  getSubmission,
  getSubmissionById,
  listPendingForMentor,
  reviewSubmission,
};
