import pool from './db.js';

async function createMissingTables() {
  try {
    console.log('Creating missing tables...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS matches (
          id character varying PRIMARY KEY,
          title VARCHAR(255),
          type VARCHAR(50) DEFAULT 'open_play',
          status VARCHAR(50) DEFAULT 'upcoming',
          date_time TIMESTAMP NOT NULL,
          court_id character varying REFERENCES courts(id),
          max_players INTEGER DEFAULT 4,
          price_per_player DECIMAL(10, 2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS match_participants (
          id character varying PRIMARY KEY,
          match_id character varying REFERENCES matches(id),
          user_id character varying REFERENCES users(id),
          status VARCHAR(50) DEFAULT 'joined',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chats (
          id character varying PRIMARY KEY,
          user_id character varying REFERENCES users(id) UNIQUE,
          user_name VARCHAR(255),
          last_message TEXT,
          last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          unread_by_admin BOOLEAN DEFAULT false,
          unread_by_customer BOOLEAN DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS messages (
          id character varying PRIMARY KEY,
          chat_id character varying REFERENCES chats(id),
          sender_id VARCHAR(255),
          sender_name VARCHAR(255),
          text TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Successfully created missing tables.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    pool.end();
  }
}

createMissingTables();
