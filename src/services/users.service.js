const pool = require('../db/pool');
const config = require('../config');

function isConfiguredAdmin(telegramId) {
  return Boolean(config.adminTelegramId) && String(telegramId) === String(config.adminTelegramId);
}

// ADMIN_TELEGRAM_ID doim haqiqat manbai: shu ID bilan kirgan foydalanuvchi
// bazadagi eski roliga qaramay har safar /start bosganda qayta "admin" qilib qo'yiladi.
async function ensureAdminRole(user) {
  if (user && user.role !== 'admin' && isConfiguredAdmin(user.telegram_id)) {
    return updateUser(user.id, { role: 'admin' });
  }
  return user;
}

async function findByTelegramId(telegramId) {
  const { rows } = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findOrCreateByTelegramId({ telegram_id, username, full_name, language_code }) {
  const existing = await findByTelegramId(telegram_id);
  if (existing) return ensureAdminRole(existing);

  const { rows } = await pool.query(
    `INSERT INTO users (telegram_id, username, full_name, language_code, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      telegram_id,
      username || null,
      full_name || 'Foydalanuvchi',
      language_code || 'uz',
      isConfiguredAdmin(telegram_id) ? 'admin' : 'student',
    ]
  );
  return rows[0];
}

async function listUsers({ role } = {}) {
  if (role) {
    const { rows } = await pool.query('SELECT * FROM users WHERE role = $1 ORDER BY full_name', [role]);
    return rows;
  }
  const { rows } = await pool.query('SELECT * FROM users ORDER BY full_name');
  return rows;
}

async function updateUser(id, fields) {
  const allowed = ['full_name', 'phone', 'role', 'is_active'];
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

  if (sets.length === 0) return findById(id);

  sets.push('updated_at = now()');
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function getMyEnrollments(userId) {
  const { rows } = await pool.query(
    `SELECT e.*, c.name AS course_name, g.name AS group_name
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     LEFT JOIN groups g ON g.id = e.group_id
     WHERE e.user_id = $1
     ORDER BY e.enrolled_at DESC`,
    [userId]
  );
  return rows;
}

module.exports = {
  findByTelegramId,
  findById,
  findOrCreateByTelegramId,
  listUsers,
  updateUser,
  getMyEnrollments,
};
