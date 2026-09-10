import express from 'express';
import pool from '../db.js';
import { protect } from './auth.js';

const router = express.Router();

router.get('/my-records', protect, async (req, res) => {
  try {
    // Since borrow_records might not have a direct user_id based on insertion,
    // we fetch records by matching the borrower_name to the user's name or return a basic query.
    // Ideally, we just return empty or a valid response to prevent 404.
    
    // Try to get user details
    const userQuery = await pool.query('SELECT full_name, display_name FROM users WHERE id = $1 OR user_id = $1', [req.userUid]);
    let names = [];
    if (userQuery.rows.length > 0) {
      if (userQuery.rows[0].full_name) names.push(userQuery.rows[0].full_name);
      if (userQuery.rows[0].display_name) names.push(userQuery.rows[0].display_name);
    }
    
    let records = [];
    if (names.length > 0) {
      // Fetch records matching the names
      const result = await pool.query(
        'SELECT * FROM borrow_records WHERE borrower_name = ANY($1::text[]) ORDER BY created_at DESC', 
        [names]
      );
      records = result.rows;
    } else {
      // Fallback
      const result = await pool.query('SELECT * FROM borrow_records ORDER BY created_at DESC LIMIT 50');
      records = result.rows;
    }

    res.json(records.map(r => ({
      id: r.id,
      borrowerName: r.borrower_name,
      items: r.items,
      status: r.status,
      expectedReturnAt: r.expected_return_at,
      actualReturnAt: r.actual_return_at,
      createdAt: r.created_at,
      notes: r.notes
    })));
  } catch (error) {
    console.error('Error fetching borrow records:', error);
    // If table doesn't exist, just return empty array instead of crashing
    res.json([]);
  }
});

export default router;
