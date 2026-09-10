import { getPool } from '../_lib/db.js';
import { protect } from '../_lib/auth.js';
import { cors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const pool = getPool();
  let decoded;
  try { decoded = protect(req); } catch (e) { return res.status(e.status || 401).json({ error: e.message }); }

  if (req.method === 'GET') {
    try {
      const chat = await pool.query('SELECT id FROM chats WHERE user_id = $1', [decoded.uid]);
      if (chat.rows.length === 0) return res.json([]);
      const messages = await pool.query('SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC', [chat.rows[0].id]);
      return res.json(messages.rows.map(m => ({
        id: m.id, senderId: m.sender_id, senderName: m.sender_name,
        text: m.text, createdAt: m.created_at, isEdited: m.is_edited,
        isDeleted: m.is_deleted, isPinned: m.is_pinned, reactions: m.reactions || {},
        image: m.image, groupId: m.group_id
      })));
    } catch (error) {
      return res.status(500).json({ error: 'Server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { text, senderName, image, groupId } = req.body || {};
      if (!text && !image) return res.status(400).json({ error: 'Message cannot be empty' });

      let chat = await pool.query('SELECT id FROM chats WHERE user_id = $1', [decoded.uid]);
      if (chat.rows.length === 0) {
        const newChatId = 'cht_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
        chat = await pool.query(
          'INSERT INTO chats (id, user_id, user_name, last_message, unread_by_admin) VALUES ($1, $2, $3, $4, true) RETURNING id',
          [newChatId, decoded.uid, senderName, text || 'Sent an image']
        );
      } else {
        await pool.query(
          'UPDATE chats SET last_message = $1, last_message_at = NOW(), unread_by_admin = true, unread_by_customer = false WHERE user_id = $2',
          [text || 'Sent an image', decoded.uid]
        );
      }
      const chatId = chat.rows[0].id;
      const msgId = 'msg_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
      const msg = await pool.query(
        'INSERT INTO messages (id, chat_id, sender_id, sender_name, text, image, group_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [msgId, chatId, decoded.uid, senderName, text, image, groupId || null]
      );
      
      const formattedMsg = {
        id: msg.rows[0].id, chatId: msg.rows[0].chat_id, senderId: msg.rows[0].sender_id,
        senderName: msg.rows[0].sender_name, text: msg.rows[0].text, createdAt: msg.rows[0].created_at,
        isEdited: false, isDeleted: false, isPinned: false, reactions: {},
        image: msg.rows[0].image, groupId: msg.rows[0].group_id
      };
      
      return res.json(formattedMsg);
    } catch (error) {
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
