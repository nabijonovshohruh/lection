const fs = require('fs');
const path = require('path');
const pool = require('./pool');
const config = require('../config');
const usersService = require('../services/users.service');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Api va bot service'lari deployda deyarli bir vaqtda ishga tushadi va ikkisi ham
// shu funksiyani chaqiradi — pg_advisory_lock orqali faqat bittasi migratsiya
// qo'llaydi, ikkinchisi kutib, keyin hech narsa qilmasdan davom etadi.
const MIGRATION_LOCK_ID = 727001;

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);

      const applied = new Set(
        (await client.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename)
      );

      const files = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        if (applied.has(file)) continue;

        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        console.log(`[db] Applying migration: ${file}`);

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    }
  } finally {
    client.release();
  }
}

// ADMIN_TELEGRAM_ID bo'yicha foydalanuvchi bazada allaqachon mavjud bo'lsa
// (masalan, env o'zgaruvchi ular /start bosgandan KEYIN sozlangan bo'lsa),
// server ishga tushganda darhol admin qilib tuzatib qo'yadi — Mini App yoki
// botni qayta ochishni kutmaydi.
async function ensureAdminUserIsPromoted() {
  if (!config.adminTelegramId) return;

  const existing = await usersService.findByTelegramId(config.adminTelegramId);
  if (existing && existing.role !== 'admin') {
    await usersService.ensureAdminRole(existing);
    console.log(`[db] telegram_id=${config.adminTelegramId} admin qilib belgilandi`);
  }
}

async function ensureReady() {
  await runMigrations();
  await ensureAdminUserIsPromoted();
}

module.exports = { ensureReady, runMigrations };
