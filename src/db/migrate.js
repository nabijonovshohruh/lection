const pool = require('./pool');
const { runMigrations } = require('./ensureReady');

runMigrations()
  .then(() => {
    console.log('Migrations complete.');
    return pool.end();
  })
  .catch(async (err) => {
    console.error('Migration failed:', err);
    await pool.end();
    process.exit(1);
  });
