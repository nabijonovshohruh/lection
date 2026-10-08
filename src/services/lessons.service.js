const pool = require('../db/pool');

async function listLessonsByCourse(courseId, { onlyPublished } = {}) {
  const query = onlyPublished
    ? 'SELECT * FROM lessons WHERE course_id = $1 AND is_published = TRUE ORDER BY order_index'
    : 'SELECT * FROM lessons WHERE course_id = $1 ORDER BY order_index';
  const { rows } = await pool.query(query, [courseId]);
  return rows;
}

async function getLessonById(id) {
  const { rows } = await pool.query('SELECT * FROM lessons WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createLesson({
  course_id,
  title,
  description,
  video_url,
  resource_url,
  duration_seconds,
  homework_text,
  order_index,
  is_published,
  type,
  scheduled_date,
  mentor_name,
  topics,
  start_time,
  end_time,
}) {
  const { rows } = await pool.query(
    `INSERT INTO lessons (
       course_id, title, description, video_url, resource_url, duration_seconds,
       homework_text, order_index, is_published, type, scheduled_date,
       mentor_name, topics, start_time, end_time
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      course_id,
      title,
      description || null,
      video_url || null,
      resource_url || null,
      duration_seconds || 0,
      homework_text || null,
      order_index,
      Boolean(is_published),
      type || 'lecture',
      scheduled_date || null,
      mentor_name || null,
      topics || null,
      start_time || null,
      end_time || null,
    ]
  );
  return rows[0];
}

async function updateLesson(id, fields) {
  const allowed = [
    'title',
    'description',
    'video_url',
    'resource_url',
    'duration_seconds',
    'homework_text',
    'order_index',
    'is_published',
    'type',
    'scheduled_date',
    'mentor_name',
    'topics',
    'start_time',
    'end_time',
  ];
  const sets = [];
  const values = [];
  let i = 1;

  for (const key of allowed) {
    if (fields[key] === undefined) continue;

    // scheduled_date DATE ustuni — "" Postgres uchun yaroqsiz, NULL'ga aylantiramiz
    const value = key === 'scheduled_date' && fields[key] === '' ? null : fields[key];

    sets.push(`${key} = $${i}`);
    values.push(value);
    i += 1;
  }

  if (sets.length === 0) return getLessonById(id);

  sets.push('updated_at = now()');
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE lessons SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function deleteLesson(id) {
  await pool.query('DELETE FROM lessons WHERE id = $1', [id]);
}

module.exports = { listLessonsByCourse, getLessonById, createLesson, updateLesson, deleteLesson };
