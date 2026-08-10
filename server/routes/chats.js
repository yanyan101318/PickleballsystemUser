import express from 'express';
import pool from '../db.js';
import { protect } from './auth.js';

const router = express.Router();

// Get unread count
router.get('/unread', protect, async (req, res) => {
  try {
    const chat = await pool.query('SELECT unread_by_customer FROM chats WHERE user_id = $1', [req.userUid]);
    if (chat.rows.length === 0) return res.json({ unread: 0 });
    res.json({ unread: chat.rows[0].unread_by_customer ? 1 : 0 });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark as read
router.post('/mark-read', protect, async (req, res) => {
  try {
    await pool.query('UPDATE chats SET unread_by_customer = false WHERE user_id = $1', [req.userUid]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages
router.get('/messages', protect, async (req, res) => {
  try {
    const chat = await pool.query('SELECT id FROM chats WHERE user_id = $1', [req.userUid]);
    if (chat.rows.length === 0) return res.json([]);
    const messages = await pool.query('SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC', [chat.rows[0].id]);
    res.json(messages.rows.map(m => ({
      id: m.id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      text: m.text,
      createdAt: m.created_at
    })));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Send message
router.post('/messages', protect, async (req, res) => {
  try {
    const { text, senderName } = req.body;
    let chat = await pool.query('SELECT id FROM chats WHERE user_id = $1', [req.userUid]);
    if (chat.rows.length === 0) {
      const newChatId = 'cht_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
      chat = await pool.query(
        'INSERT INTO chats (id, user_id, user_name, last_message, unread_by_admin) VALUES ($1, $2, $3, $4, true) RETURNING id',
        [newChatId, req.userUid, senderName, text]
      );
    } else {
      await pool.query(
        'UPDATE chats SET last_message = $1, last_message_at = NOW(), unread_by_admin = true, unread_by_customer = false WHERE user_id = $2',
        [text, req.userUid]
      );
    }
    const chatId = chat.rows[0].id;
    const msgId = 'msg_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
    const msg = await pool.query(
      'INSERT INTO messages (id, chat_id, sender_id, sender_name, text) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [msgId, chatId, req.userUid, senderName, text]
    );
    res.json({
      id: msg.rows[0].id,
      senderId: msg.rows[0].sender_id,
      senderName: msg.rows[0].sender_name,
      text: msg.rows[0].text,
      createdAt: msg.rows[0].created_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});
// ADMIN ENDPOINTS

// Get all chats
router.get('/admin/chats', protect, async (req, res) => {
  try {
    const chats = await pool.query('SELECT * FROM chats ORDER BY last_message_at DESC');
    res.json(chats.rows.map(c => ({
      id: c.id,
      userId: c.user_id,
      userName: c.user_name,
      lastMessage: c.last_message,
      lastMessageAt: c.last_message_at,
      unreadByAdmin: c.unread_by_admin,
      unreadByCustomer: c.unread_by_customer
    })));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a specific chat
router.get('/admin/chats/:chatId/messages', protect, async (req, res) => {
  try {
    const messages = await pool.query('SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC', [req.params.chatId]);
    res.json(messages.rows.map(m => ({
      id: m.id,
      chatId: m.chat_id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      text: m.text,
      createdAt: m.created_at
    })));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark chat as read by admin
router.post('/admin/chats/:chatId/mark-read', protect, async (req, res) => {
  try {
    await pool.query('UPDATE chats SET unread_by_admin = false WHERE id = $1', [req.params.chatId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Send message as admin
router.post('/admin/chats/:chatId/messages', protect, async (req, res) => {
  try {
    const { text, senderName } = req.body;
    const { chatId } = req.params;
    
    // Update chat
    await pool.query(
      'UPDATE chats SET last_message = $1, last_message_at = NOW(), unread_by_admin = false, unread_by_customer = true WHERE id = $2',
      [text, chatId]
    );

    // Insert message
    const msgId = 'msg_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
    const msg = await pool.query(
      'INSERT INTO messages (id, chat_id, sender_id, sender_name, text) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [msgId, chatId, req.userUid, senderName || 'Admin', text]
    );

    res.json({
      id: msg.rows[0].id,
      senderId: msg.rows[0].sender_id,
      senderName: msg.rows[0].sender_name,
      text: msg.rows[0].text,
      createdAt: msg.rows[0].created_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
