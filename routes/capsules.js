const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { makeUploader } = require('../middleware/upload');
const router = express.Router();
const upload = makeUploader('photos');

async function getOther(userId) {
  const [[me]] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
  const [[other]] = await pool.query('SELECT id FROM users WHERE role <> ?', [me.role]);
  return other ? other.id : null;
}

router.get('/', requireAuth, async (req, res) => {
  const uid = req.session.userId;
  // sender sees own (any state); receiver sees only unlocked
  const [rows] = await pool.query(
    `SELECT c.*, s.role AS sender_role, s.nickname AS sender_nickname,
            (c.unlock_at <= NOW()) AS unlocked
     FROM capsules c LEFT JOIN users s ON s.id = c.sender_id
     WHERE c.sender_id = ? OR (c.receiver_id = ? AND c.unlock_at <= NOW())
     ORDER BY c.unlock_at ASC`,
    [uid, uid]
  );
  res.json({ list: rows });
});

router.get('/pending', requireAuth, async (req, res) => {
  // capsules addressed to me, just unlocked, not yet read
  const [rows] = await pool.query(
    `SELECT c.*, s.role AS sender_role, s.nickname AS sender_nickname FROM capsules c
     LEFT JOIN users s ON s.id = c.sender_id
     WHERE c.receiver_id = ? AND c.unlock_at <= NOW() AND c.is_read = 0`,
    [req.session.userId]
  );
  res.json({ list: rows });
});

router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  const { content, unlock_at } = req.body;
  if (!content || !unlock_at) return res.status(400).json({ error: '内容和解锁时间必填' });
  const other = await getOther(req.session.userId);
  const image = req.file ? '/uploads/photos/' + req.file.filename : '';
  await pool.query(
    'INSERT INTO capsules (content,image,sender_id,receiver_id,unlock_at) VALUES (?,?,?,?,?)',
    [content, image, req.session.userId, other, unlock_at]
  );
  res.json({ ok: true });
});

router.post('/:id/read', requireAuth, async (req, res) => {
  await pool.query('UPDATE capsules SET is_read = 1 WHERE id = ? AND receiver_id = ?', [req.params.id, req.session.userId]);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM capsules WHERE id = ? AND sender_id = ?', [req.params.id, req.session.userId]);
  res.json({ ok: true });
});

module.exports = router;
