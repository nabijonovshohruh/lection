require('dotenv').config();
const pool = require('../pool');

async function seed() {
  const telegramId = process.env.ADMIN_TELEGRAM_ID;
  const fullName = process.env.ADMIN_FULL_NAME || 'Super Admin';

  if (!telegramId) {
    console.error('ADMIN_TELEGRAM_ID is not set in .env');
    process.exit(1);
  }

  await pool.query(
    `INSERT INTO users (telegram_id, full_name, role)
     VALUES ($1, $2, 'admin')
     ON CONFLICT (telegram_id) DO UPDATE SET role = 'admin'`,
    [telegramId, fullName]
  );

  console.log(`Admin user seeded: telegram_id=${telegramId}`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
