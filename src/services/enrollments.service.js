const pool = require('../db/pool');

// Guruhga biriktirmasdan ham (group_id = NULL) kursga kirish huquqi berish mumkin —
// sig'im trigger'i faqat group_id to'ldirilganda ishga tushadi (migrations/010).
async function grantAccess(userId, courseId, groupId = null) {
  const { rows } = await pool.query(
    `INSERT INTO enrollments (user_id, course_id, group_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, course_id)
     DO UPDATE SET
       status = 'active',
       group_id = COALESCE($3, enrollments.group_id),
       removed_at = NULL
     RETURNING *`,
    [userId, courseId, groupId]
  );
  return rows[0];
}

async function revokeAccess(userId, courseId) {
  const { rows } = await pool.query(
    `UPDATE enrollments
     SET status = 'dropped', removed_at = now()
     WHERE user_id = $1 AND course_id = $2
     RETURNING *`,
    [userId, courseId]
  );
  return rows[0] || null;
}

async function listEnrollmentsForCourse(courseId) {
  const { rows } = await pool.query(
    `SELECT e.*, u.full_name, u.telegram_id, g.name AS group_name
     FROM enrollments e
     JOIN users u ON u.id = e.user_id
     LEFT JOIN groups g ON g.id = e.group_id
     WHERE e.course_id = $1
     ORDER BY e.status, u.full_name`,
    [courseId]
  );
  return rows;
}

module.exports = { grantAccess, revokeAccess, listEnrollmentsForCourse };
