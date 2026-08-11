import pool from './db.js';

async function migrate() {
  try {
    console.log("Starting users table migration...");
    
    // Add phone column if it doesn't exist
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`);
    console.log("Added phone column.");
    
    // Add password_hash column if it doesn't exist
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);`);
    console.log("Added password_hash column.");
    
    // Add membership column if it doesn't exist
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS membership VARCHAR(50) DEFAULT 'basic';`);
    console.log("Added membership column.");
    
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

migrate();
