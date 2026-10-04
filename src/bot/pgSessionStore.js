const pool = require('../db/pool');

// Telegraf session() middleware shuni get/set/delete orqali chaqiradi.
module.exports = {
  async get(key) {
    const { rows } = await pool.query('SELECT data FROM bot_sessions WHERE key = $1', [key]);
    return rows[0]?.data;
  },

  async set(key, value) {
    await pool.query(
      `INSERT INTO bot_sessions (key, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [key, value]
    );
  },

  async delete(key) {
    await pool.query('DELETE FROM bot_sessions WHERE key = $1', [key]);
  },
};
