import pool from './db.js';

async function inspectSchema() {
  try {
    const tables = ['chats', 'messages'];
    for (const table of tables) {
      const result = await pool.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [table]);
      console.log(`\nTable: ${table}`);
      result.rows.forEach(row => {
        console.log(`  ${row.column_name} (${row.data_type})`);
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

inspectSchema();
