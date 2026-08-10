import fs from 'fs';
import pg from 'pg';

const pool = new pg.Pool({
  user: 'postgres',
  password: 'converge',
  host: 'localhost',
  port: 5432,
  database: 'ranaw_pickleball',
});

async function restoreDatabase() {
  try {
    console.log('Reading backup file...');
    const sql = fs.readFileSync('D:\\ranaw_pickleball.sql', 'utf8');
    
    console.log('Executing backup SQL...');
    await pool.query(sql);
    
    console.log('Database restored successfully!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    pool.end();
  }
}

restoreDatabase();
