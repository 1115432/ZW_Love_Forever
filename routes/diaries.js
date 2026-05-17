const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { q } = req.query;
  let sql = `SELECT d.*, u.role AS author_role, u.nickname AS author_nickname
             FROM diaries d LEFT JOIN users u ON u.id = d.author_id
             WHERE d.is_draft = 0`;
  const vals = [];
  if (q) { sql += ' AND d.content LIKE ?'; vals.push('%' + q + '%'); }
  sql += ' ORDER BY d.created_at DESC';
  const [rows] = await pool.query(sql, vals);
  res.json({ list: rows });
});

router.get('/:id', requireAuth, async (req, res) => {
  const [[d]] = await pool.query(
    `SELECT d.*, u.role AS author_role, u.nickname AS author_nickname
     FROM diaries d LEFT JOIN users u ON u.id = d.author_id WHERE d.id = ?`,
    [req.params.id]
  );
  if (!d) return res.status(404).json({ error: '日记已不在了' });
  const [comments] = await pool.query(
    `SELECT c.*, u.role, u.nickname FROM diary_comments c
     LEFT JOIN users u ON u.id = c.author_id WHERE c.diary_id = ? ORDER BY c.created_at ASC`,
    [req.params.id]
  );
  res.json({ diary: d, comments });
});

router.post('/', requireAuth, async (req, res) => {
  const { content, weather = '', is_draft = 0 } = req.body;
  if (!content) return res.status(400).json({ error: '日记内容不能为空' });
  const [r] = await pool.query(
    'INSERT INTO diaries (content,weather,author_id,is_draft) VALUES (?,?,?,?)',
    [content, weather, req.session.userId, Number(is_draft) ? 1 : 0]
  );
  res.json({ ok: true, id: r.insertId });
});

router.put('/:id', requireAuth, async (req, res) => {
  const { content, weather, is_draft } = req.body;
  const fields = [], vals = [];
  if (content !== undefined) { fields.push('content = ?'); vals.push(content); }
  if (weather !== undefined) { fields.push('weather = ?'); vals.push(weather); }
  if (is_draft !== undefined) { fields.push('is_draft = ?'); vals.push(Number(is_draft) ? 1 : 0); }
  if (!fields.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE diaries SET ${fields.join(',')} WHERE id = ?`, vals);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM diary_comments WHERE diary_id = ?', [req.params.id]);
  await pool.query('DELETE FROM diaries WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

router.post('/:id/like', requireAuth, async (req, res) => {
  await pool.query('UPDATE diaries SET likes = likes + 1, liked_by_other = 1 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

router.post('/:id/comment', requireAuth, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: '请写下你的话' });
  await pool.query(
    'INSERT INTO diary_comments (diary_id,author_id,content) VALUES (?,?,?)',
    [req.params.id, req.session.userId, content]
  );
  res.json({ ok: true });
});

module.exports = router;
