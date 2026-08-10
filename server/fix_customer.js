import pool from './db.js';

async function fix() {
  await pool.query(
    "INSERT INTO customers (id, user_id, full_name, contact_number, email) VALUES ('cust_ryan', 'usr_mryhsryi5e8kkbm8y4a', 'Ryan Roy Lausing', '09123456789', 'ryanroylausing@sksu.edu.ph') ON CONFLICT DO NOTHING"
  );
  console.log('Fixed');
  process.exit(0);
}
fix();
