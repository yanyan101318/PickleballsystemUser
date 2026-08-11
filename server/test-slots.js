import pool from './db.js';

async function test() {
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bookings'");
  console.log(res.rows);
  process.exit(0);
}
test();
