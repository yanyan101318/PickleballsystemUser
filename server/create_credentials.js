import pool from './db.js';

async function createCredentialsTable() {
  try {
    console.log('Creating user_credentials table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_credentials (
          user_id character varying PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          password_hash VARCHAR(255) NOT NULL
      );
    `);
    console.log('Successfully created user_credentials table.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    pool.end();
  }
}

createCredentialsTable();
