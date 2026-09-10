import { getPool } from '../_lib/db.js';
import { cors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { type } = req.query;
  const pool = getPool();
  try {
    let query = 'SELECT * FROM inventory_items';
    const params = [];
    if (type) {
      const lower = type.toLowerCase();
      if (lower === 'rent' || lower === 'rental') {
        query += " WHERE (LOWER(type) = 'rental' OR LOWER(type) = 'rent')";
      } else if (lower === 'sale' || lower === 'for_sale') {
        query += " WHERE (LOWER(type) = 'sale' OR LOWER(type) = 'for_sale')";
      } else {
        query += ' WHERE LOWER(type) = $1';
        params.push(lower);
      }
    }
    query += ' ORDER BY category ASC, name ASC';
    const result = await pool.query(query, params);
    return res.json(result.rows.map(item => ({
      id: item.id, name: item.name, category: item.category,
      notes: item.notes, type: item.type,
      price: item.price ?? item.sale_price ?? 0,
      pricePerHour: item.price_per_hour ?? 0,
      availableQty: item.available_qty ?? 0,
      totalQty: item.total_qty ?? 0,
      overdueFinePerHour: item.overdue_fine_per_hour ?? 0,
      createdAt: item.created_at, updatedAt: item.updated_at,
    })));
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
