const pool = require('../db/pool');
const config = require('../config');

// Probel va tasodifiy qo'shtirnoqlardan (Railway Variables'ga qiymat
// noto'g'ri formatda kiritilsa) tozalaydi, so'ng solishtiradi.
function normalizeId(value) {
  return String(value).trim().replace(/^['"]+|['"]+$/g, '');
}

function isConfiguredAdmin(telegramId) {
  const configured = config.adminTelegramId ? normalizeId(config.adminTelegramId) : '';
  const incoming = normalizeId(telegramId);
  const result = Boolean(configured) && incoming === configured;

  console.log(
    `[admin-check] incoming=${JSON.stringify(incoming)} (${typeof telegramId}) ` +
      `configured=${JSON.stringify(configured)} (${typeof config.adminTelegramId}) match=${result}`
  );

  return result;
}

// ADMIN_TELEGRAM_ID doim haqiqat manbai: shu ID bilan kirgan foydalanuvchi
// bazadagi eski roliga qaramay har safar /start bosganda qayta "admin" qilib qo'yiladi.
async function ensureAdminRole(user) {
  if (!user) return user;

  if (user.role === 'admin') {
    console.log(`[ensure-admin] user#${user.id} (telegram_id=${user.telegram_id}) allaqachon admin`);
    return user;
  }

  if (isConfiguredAdmin(user.telegram_id)) {
    console.log(`[ensure-admin] user#${user.id} (telegram_id=${user.telegram_id}) admin'ga yangilanmoqda`);
    const updated = await updateUser(user.id, { role: 'admin' });
    console.log(`[ensure-admin] yangilandi: role=${updated?.role}`);
    return updated;
  }

  console.log(
    `[ensure-admin] user#${user.id} (telegram_id=${user.telegram_id}) admin emas, role='${user.role}' qoladi`
  );
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

async function listUsers({ role, search } = {}) {
  const conditions = [];
  const params = [];

  if (role) {
    params.push(role);
    conditions.push(`role = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(full_name ILIKE $${params.length} OR username ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM users ${where} ORDER BY full_name LIMIT 50`,
    params
  );
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
  ensureAdminRole,
  listUsers,
  updateUser,
  getMyEnrollments,
};
