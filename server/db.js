import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ranaw_pickleball',
  password: process.env.DB_PASSWORD || 'converge',
  port: process.env.DB_PORT || 5432,
});

export const query = (text, params) => pool.query(text, params);
export default pool;
