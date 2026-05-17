const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT a.*, (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id) AS photo_count
     FROM albums a ORDER BY a.created_at DESC`
  );
  res.json({ list: rows });
});

router.post('/', requireAuth, async (req, res) => {
  const { name, description = '', cover = '' } = req.body;
  if (!name) return res.status(400).json({ error: '请填写相册名' });
  const [r] = await pool.query(
    'INSERT INTO albums (name,description,cover,author_id) VALUES (?,?,?,?)',
    [name, description, cover, req.session.userId]
  );
  res.json({ ok: true, id: r.insertId });
});

router.put('/:id', requireAuth, async (req, res) => {
  const { name, description, cover } = req.body;
  const fields = [], vals = [];
  if (name !== undefined) { fields.push('name = ?'); vals.push(name); }
  if (description !== undefined) { fields.push('description = ?'); vals.push(description); }
  if (cover !== undefined) { fields.push('cover = ?'); vals.push(cover); }
  if (!fields.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE albums SET ${fields.join(',')} WHERE id = ?`, vals);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, async (req, res) => {
  await pool.query('UPDATE photos SET album_id = NULL WHERE album_id = ?', [req.params.id]);
  await pool.query('DELETE FROM albums WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

router.post('/:id/view', requireAuth, async (req, res) => {
  await pool.query('INSERT INTO album_views (album_id, viewer_id) VALUES (?,?)', [req.params.id, req.session.userId]);
  res.json({ ok: true });
});

router.get('/:id/views', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT v.*, u.role, u.nickname FROM album_views v
     LEFT JOIN users u ON u.id = v.viewer_id
     WHERE v.album_id = ? ORDER BY v.viewed_at DESC LIMIT 100`,
    [req.params.id]
  );
  res.json({ list: rows });
});

module.exports = router;
