import pool from './db.js';

async function alterPaymentsTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(`
      ALTER TABLE payments 
      ALTER COLUMN id TYPE VARCHAR(255),
      ALTER COLUMN booking_id TYPE VARCHAR(255),
      ALTER COLUMN user_id TYPE VARCHAR(255),
      ALTER COLUMN court_id TYPE VARCHAR(255)
    `);
    
    await client.query('COMMIT');
    console.log('Payments table altered successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error altering table:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

alterPaymentsTable();
