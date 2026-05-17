const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

async function getOther(userId) {
  const [[me]] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
  const [[other]] = await pool.query('SELECT id FROM users WHERE role <> ?', [me.role]);
  return other ? other.id : null;
}

router.get('/', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT m.*, s.role AS sender_role, s.nickname AS sender_nickname
     FROM messages m LEFT JOIN users s ON s.id = m.sender_id
     ORDER BY m.created_at ASC`
  );
  // Mark messages to me as read
  await pool.query('UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND is_read = 0', [req.session.userId]);
  res.json({ list: rows });
});

router.get('/unread', requireAuth, async (req, res) => {
  const [[r]] = await pool.query(
    'SELECT COUNT(*) AS c FROM messages WHERE receiver_id = ? AND is_read = 0',
    [req.session.userId]
  );
  res.json({ count: r.c });
});

router.post('/', requireAuth, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: '悄悄话不能为空哦' });
  const other = await getOther(req.session.userId);
  await pool.query(
    'INSERT INTO messages (content,sender_id,receiver_id) VALUES (?,?,?)',
    [content, req.session.userId, other]
  );
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM messages WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
