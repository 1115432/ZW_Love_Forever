const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Get all tags
router.get('/', requireAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM travel_tags ORDER BY created_at DESC');
  res.json({ list: rows });
});

// Create a new tag
router.post('/', requireAuth, async (req, res) => {
  const { name, color = '#FF6B6B' } = req.body;
  if (!name) return res.status(400).json({ error: '请填写标签名称' });
  try {
    const [r] = await pool.query(
      'INSERT INTO travel_tags (name, color) VALUES (?, ?)',
      [name, color]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '标签名称已存在' });
    }
    throw e;
  }
});

// Update a tag
router.put('/:id', requireAuth, async (req, res) => {
  const { name, color } = req.body;
  const fields = [], vals = [];
  if (name !== undefined) { fields.push('name = ?'); vals.push(name); }
  if (color !== undefined) { fields.push('color = ?'); vals.push(color); }
  if (!fields.length) return res.json({ ok: true });
  vals.push(req.params.id);
  try {
    await pool.query(`UPDATE travel_tags SET ${fields.join(',')} WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '标签名称已存在' });
    }
    throw e;
  }
});

// Delete a tag
router.delete('/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM travel_tags WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
