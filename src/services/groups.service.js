const pool = require('../db/pool');

async function listGroupsByCourse(courseId) {
  const { rows } = await pool.query(
    `SELECT g.*, u.full_name AS mentor_name, u.username AS mentor_username,
       (SELECT COUNT(*) FROM enrollments e WHERE e.group_id = g.id AND e.status = 'active') AS student_count
     FROM groups g
     LEFT JOIN users u ON u.id = g.mentor_id
     WHERE g.course_id = $1
     ORDER BY g.name`,
    [courseId]
  );
  return rows;
}

async function listGroupsForMentor(mentorId) {
  const { rows } = await pool.query(
    `SELECT g.*, c.name AS course_name,
       (SELECT COUNT(*) FROM enrollments e WHERE e.group_id = g.id AND e.status = 'active') AS student_count
     FROM groups g
     JOIN courses c ON c.id = g.course_id
     WHERE g.mentor_id = $1
     ORDER BY g.created_at DESC`,
    [mentorId]
  );
  return rows;
}

async function getGroupById(id) {
  const { rows } = await pool.query('SELECT * FROM groups WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createGroup({ course_id, name, capacity }) {
  const { rows } = await pool.query(
    'INSERT INTO groups (course_id, name, capacity) VALUES ($1, $2, $3) RETURNING *',
    [course_id, name, capacity || 30]
  );
  return rows[0];
}

async function updateGroup(id, fields) {
  const allowed = ['name', 'capacity'];
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

  if (sets.length === 0) return getGroupById(id);

  sets.push('updated_at = now()');
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE groups SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function deleteGroup(id) {
  await pool.query('DELETE FROM groups WHERE id = $1', [id]);
}

async function assignMentor(groupId, mentorId) {
  await pool.query("UPDATE users SET role = 'mentor' WHERE id = $1 AND role = 'student'", [mentorId]);
  const { rows } = await pool.query(
    'UPDATE groups SET mentor_id = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [mentorId, groupId]
  );
  return rows[0] || null;
}

async function addStudentToGroup(groupId, studentId) {
  const group = await getGroupById(groupId);
  if (!group) throw new Error('Group not found');

  const { rows } = await pool.query(
    `INSERT INTO enrollments (user_id, course_id, group_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, course_id)
     DO UPDATE SET group_id = EXCLUDED.group_id, status = 'active', removed_at = NULL
     RETURNING *`,
    [studentId, group.course_id, groupId]
  );
  return rows[0];
}

async function listGroupMembers(groupId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.telegram_id, u.full_name, u.username, e.status, e.enrolled_at
     FROM enrollments e
     JOIN users u ON u.id = e.user_id
     WHERE e.group_id = $1
     ORDER BY u.full_name`,
    [groupId]
  );
  return rows;
}

module.exports = {
  listGroupsByCourse,
  listGroupsForMentor,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  assignMentor,
  addStudentToGroup,
  listGroupMembers,
};
