import pg from 'pg';

const pool = new pg.Pool({
  user: 'postgres',
  password: 'converge',
  host: 'localhost',
  port: 5432,
  database: 'ranaw_pickleball',
});

async function resetSchema() {
  try {
    console.log('Dropping public schema...');
    await pool.query('DROP SCHEMA public CASCADE;');
    console.log('Recreating public schema...');
    await pool.query('CREATE SCHEMA public;');
    console.log('Schema reset successfully.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    pool.end();
  }
}

resetSchema();
