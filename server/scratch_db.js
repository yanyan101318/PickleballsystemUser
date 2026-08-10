import pool from './db.js';
async function test() {
  try {
    const res = await pool.query('SELECT * FROM admin');
    console.log("Admin table exists, rows:", res.rows.length);
  } catch(e) {
    console.error("DB Error:", e.message);
  }
  pool.end();
}
test();
