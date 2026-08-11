import pool from './db.js';

async function checkSchema() {
  try {
    // Check foreign keys referencing 'users'
    const fks = await pool.query(`
      SELECT 
          tc.table_name, 
          kcu.column_name, 
          ccu.table_name AS foreign_table_name, 
          ccu.column_name AS foreign_column_name 
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu 
            ON tc.constraint_name = kcu.constraint_name 
            AND tc.table_schema = kcu.table_schema 
          JOIN information_schema.constraint_column_usage AS ccu 
            ON ccu.constraint_name = tc.constraint_name 
            AND ccu.table_schema = tc.table_schema 
      WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'users';
    `);
    console.log("Foreign Keys pointing to users:", fks.rows);

    // Check users column types
    const creds = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_credentials'");
    console.log("Credentials columns:", creds.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
checkSchema();
