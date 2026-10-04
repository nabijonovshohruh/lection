const pool = require('../db/pool');

function slugify(name) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-') +
    '-' +
    Date.now().toString(36)
  );
}

async function createCourse({ name, description, start_date, end_date, created_by }) {
  const slug = slugify(name);
  const { rows } = await pool.query(
    `INSERT INTO courses (name, slug, description, start_date, end_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [name, slug, description || null, start_date || null, end_date || null, created_by || null]
  );
  return rows[0];
}

async function listCoursesForUser(user) {
  if (user.role === 'admin') {
    const { rows } = await pool.query('SELECT * FROM courses ORDER BY created_at DESC');
    return rows;
  }

  if (user.role === 'mentor') {
    const { rows } = await pool.query(
      `SELECT DISTINCT c.* FROM courses c
       JOIN groups g ON g.course_id = c.id
       WHERE g.mentor_id = $1
       ORDER BY c.created_at DESC`,
      [user.id]
    );
    return rows;
  }

  const { rows } = await pool.query(
    `SELECT c.* FROM courses c
     JOIN enrollments e ON e.course_id = c.id
     WHERE e.user_id = $1 AND e.status = 'active'
     ORDER BY c.created_at DESC`,
    [user.id]
  );
  return rows;
}

async function getCourseById(id) {
  const { rows } = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);
  return rows[0] || null;
}

async function userHasCourseAccess(user, courseId) {
  if (user.role === 'admin') return true;

  if (user.role === 'mentor') {
    const { rows } = await pool.query(
      'SELECT 1 FROM groups WHERE course_id = $1 AND mentor_id = $2 LIMIT 1',
      [courseId, user.id]
    );
    return rows.length > 0;
  }

  const { rows } = await pool.query(
    "SELECT 1 FROM enrollments WHERE course_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1",
    [courseId, user.id]
  );
  return rows.length > 0;
}

async function updateCourse(id, fields) {
  const allowed = ['name', 'description', 'status', 'start_date', 'end_date'];
  const sets = [];
  const values = [];
  let i = 1;

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${i}`);
      values.push(fields[key]);
      i += 1;
    }
  }

  if (sets.length === 0) return getCourseById(id);

  sets.push('updated_at = now()');
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE courses SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function deleteCourse(id) {
  await pool.query('DELETE FROM courses WHERE id = $1', [id]);
}

module.exports = {
  createCourse,
  listCoursesForUser,
  getCourseById,
  userHasCourseAccess,
  updateCourse,
  deleteCourse,
};
