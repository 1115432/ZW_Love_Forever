const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { makeUploader } = require('../middleware/upload');
const router = express.Router();
const upload = makeUploader('photos');

router.get('/', requireAuth, async (req, res) => {
  const { category, album_id, q } = req.query;
  let sql = `SELECT p.*, u.role AS author_role, u.nickname AS author_nickname
             FROM photos p LEFT JOIN users u ON u.id = p.author_id WHERE 1=1`;
  const vals = [];
  if (category) { sql += ' AND p.category = ?'; vals.push(category); }
  if (album_id) { sql += ' AND p.album_id = ?'; vals.push(album_id); }
  if (q) { sql += ' AND p.remark LIKE ?'; vals.push('%' + q + '%'); }
  sql += ' ORDER BY COALESCE(p.taken_at, p.created_at) DESC, p.id DESC';
  const [rows] = await pool.query(sql, vals);
  res.json({ list: rows });
});

router.get('/timeline', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.*, u.role AS author_role, u.nickname AS author_nickname
     FROM photos p LEFT JOIN users u ON u.id = p.author_id
     ORDER BY COALESCE(p.taken_at, p.created_at) DESC, p.id DESC`
  );
  const groups = {};
  rows.forEach(p => {
    const d = new Date(p.taken_at || p.created_at);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const yearKey = `${year}`;
    const monthKey = `${year}-${month}`;
    const dayKey = `${year}-${month}-${day}`;
    
    if (!groups[yearKey]) {
      groups[yearKey] = { type: 'year', label: `${year}年`, months: {} };
    }
    if (!groups[yearKey].months[monthKey]) {
      groups[yearKey].months[monthKey] = { type: 'month', label: `${year}年${month}月`, days: {} };
    }
    if (!groups[yearKey].months[monthKey].days[dayKey]) {
      groups[yearKey].months[monthKey].days[dayKey] = { type: 'day', label: `${month}月${day}日`, items: [] };
    }
    groups[yearKey].months[monthKey].days[dayKey].items.push(p);
  });
  res.json({ groups });
});

router.post('/', requireAuth, upload.array('files', 30), async (req, res) => {
  const { category = 'daily', album_id = null, remark = '', taken_at = null } = req.body;
  if (!req.files || !req.files.length) return res.status(400).json({ error: '请选择文件' });
  const inserts = req.files.map(f => {
    const ext = f.originalname.toLowerCase();
    const mediaType = ext.match(/\.(mp4|webm|mov|avi)$/i) ? 'video' : 'image';
    return [
      '/uploads/photos/' + f.filename, remark, req.session.userId,
      taken_at || null, category, album_id || null, mediaType
    ];
  });
  await pool.query(
    'INSERT INTO photos (path,remark,author_id,taken_at,category,album_id,media_type) VALUES ?',
    [inserts]
  );
  res.json({ ok: true, count: inserts.length });
});

router.put('/:id', requireAuth, async (req, res) => {
  const { remark, category, album_id, taken_at } = req.body;
  const fields = [], vals = [];
  if (remark !== undefined) { fields.push('remark = ?'); vals.push(remark); }
  if (category !== undefined) { fields.push('category = ?'); vals.push(category); }
  if (album_id !== undefined) { fields.push('album_id = ?'); vals.push(album_id || null); }
  if (taken_at !== undefined) { fields.push('taken_at = ?'); vals.push(taken_at || null); }
  if (!fields.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE photos SET ${fields.join(',')} WHERE id = ?`, vals);
  res.json({ ok: true });
});

router.post('/batch-move', requireAuth, async (req, res) => {
  const { ids = [], album_id = null } = req.body;
  if (!ids.length) return res.json({ ok: true });
  await pool.query('UPDATE photos SET album_id = ? WHERE id IN (?)', [album_id || null, ids]);
  res.json({ ok: true });
});

router.post('/batch-delete', requireAuth, async (req, res) => {
  const { ids = [] } = req.body;
  if (!ids.length) return res.json({ ok: true });
  await pool.query('DELETE FROM photos WHERE id IN (?)', [ids]);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM photos WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
