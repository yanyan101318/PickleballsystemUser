import pool from './db.js';
import bcrypt from 'bcryptjs';

async function testRegister() {
  const email = 'testadmin@example.com';
  const password = 'password123';
  const fullName = 'Test Admin';
  const phone = '1234567890';

  try {
    const userExists = await pool.query('SELECT * FROM admin WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      console.log('User already exists');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const uid = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2);

    await pool.query(
      `INSERT INTO admin (uid, email, password_hash, full_name, phone, role) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uid, email, passwordHash, fullName, phone || '', 'admin']
    );
    console.log("Registered successfully.");
  } catch (error) {
    console.error('Registration error:', error);
  } finally {
    pool.end();
  }
}

testRegister();
