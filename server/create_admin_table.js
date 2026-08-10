import pool from './db.js';
async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin (
          uid VARCHAR(255) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(255),
          phone VARCHAR(50),
          role VARCHAR(50) DEFAULT 'admin',
          photo_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table 'admin' created successfully.");
  } catch(e) {
    console.error("DB Error:", e.message);
  }
  pool.end();
}
run();
