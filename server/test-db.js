import pool from './db.js';
async function test() {
  try {
    const usersCount = await pool.query("SELECT COUNT(*) FROM users");
    const adminCount = await pool.query("SELECT COUNT(*) FROM admin");
    console.log('users count:', usersCount.rows[0].count);
    console.log('admin count:', adminCount.rows[0].count);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
