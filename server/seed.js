import pool from './db.js';

async function seedDatabase() {
  try {
    console.log('Seeding database...');

    // Seed Courts
    await pool.query(`
      INSERT INTO courts (name, type, location, price_per_hour, rating, reviews, max_players, description, is_active, base_status, available)
      VALUES
      ('Court A – Arena Pro', 'Indoor', 'Main Hall', 350, 4.8, 120, 16, 'Premium indoor court', true, true, true),
      ('Court B – Sunrise', 'Outdoor', 'East Wing', 280, 4.5, 80, 16, 'Beautiful outdoor sunrise view', true, true, true),
      ('Court C – Championship', 'Indoor', 'Main Hall', 420, 5.0, 200, 16, 'Professional championship court', true, true, true),
      ('Court D – Sunset View', 'Outdoor', 'West Wing', 300, 4.7, 95, 16, 'Relaxing sunset view', true, true, true)
      ON CONFLICT DO NOTHING;
    `);

    // Seed Announcements
    await pool.query(`
      INSERT INTO announcements (title, content)
      VALUES
      ('Welcome to Ranaw Pickleball', 'We have officially migrated to our new PostgreSQL system!'),
      ('Maintenance Notice', 'Courts B and D will undergo cleaning this Sunday morning.')
      ON CONFLICT DO NOTHING;
    `);

    // Seed Inventory Items
    await pool.query(`
      INSERT INTO inventory_items (name, category, type, notes, available_qty, total_qty)
      VALUES
      ('Pro Pickleball Paddle', 'Equipment', 'rent', 'High quality paddle for rent', 20, 20),
      ('Pickleball Set (3 Balls)', 'Equipment', 'rent', 'Standard outdoor balls', 50, 50)
      ON CONFLICT DO NOTHING;
    `);

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    pool.end();
  }
}

seedDatabase();
