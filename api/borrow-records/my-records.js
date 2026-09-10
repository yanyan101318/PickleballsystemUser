import { getPool } from '../_lib/db.js';
import { protect } from '../_lib/auth.js';
import { cors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let decoded;
  try { decoded = protect(req); } catch (e) { return res.status(e.status || 401).json({ error: e.message }); }

  const pool = getPool();
  try {
    const userQuery = await pool.query(
      'SELECT full_name, display_name FROM users WHERE id = $1 OR user_id = $1',
      [decoded.uid]
    );
    let names = [];
    if (userQuery.rows.length > 0) {
      if (userQuery.rows[0].full_name) names.push(userQuery.rows[0].full_name);
      if (userQuery.rows[0].display_name) names.push(userQuery.rows[0].display_name);
    }

    let records = [];
    if (names.length > 0) {
      const result = await pool.query(
        'SELECT * FROM borrow_records WHERE borrower_name = ANY($1::text[]) ORDER BY created_at DESC',
        [names]
      );
      records = result.rows;
    } else {
      const result = await pool.query('SELECT * FROM borrow_records ORDER BY created_at DESC LIMIT 50');
      records = result.rows;
    }

    return res.json(records.map(r => ({
      id: r.id, borrowerName: r.borrower_name, items: r.items, status: r.status,
      expectedReturnAt: r.expected_return_at, actualReturnAt: r.actual_return_at,
      createdAt: r.created_at, notes: r.notes,
    })));
  } catch (error) {
    console.error('Error fetching borrow records:', error);
    return res.json([]); // Return empty array on error like old code
  }
}
