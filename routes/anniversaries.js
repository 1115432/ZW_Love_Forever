const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { makeUploader } = require('../middleware/upload');
const router = express.Router();
const upload = makeUploader('photos');

router.get('/', requireAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM anniversaries ORDER BY pinned DESC, date ASC');
  res.json({ list: rows });
});

router.post('/', requireAuth, upload.single('photo'), async (req, res) => {
  const { name, date, type = 'custom', is_lunar = 0, remark = '', remind_days = 7 } = req.body;
  if (!name || !date) return res.status(400).json({ error: '名称和日期是必填的' });
  const photo = req.file ? '/uploads/photos/' + req.file.filename : (req.body.photo || '');
  const [r] = await pool.query(
    'INSERT INTO anniversaries (name,date,type,is_lunar,remark,photo,remind_days,author_id) VALUES (?,?,?,?,?,?,?,?)',
    [name, date, type, Number(is_lunar) ? 1 : 0, remark, photo, Number(remind_days), req.session.userId]
  );
  res.json({ ok: true, id: r.insertId });
});

router.put('/:id', requireAuth, upload.single('photo'), async (req, res) => {
  const { name, date, type, is_lunar, remark, remind_days, pinned } = req.body;
  const fields = [];
  const vals = [];
  const map = { name, date, type, remark };
  Object.entries(map).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = ?`); vals.push(v); } });
  if (is_lunar !== undefined) { fields.push('is_lunar = ?'); vals.push(Number(is_lunar) ? 1 : 0); }
  if (remind_days !== undefined) { fields.push('remind_days = ?'); vals.push(Number(remind_days)); }
  if (pinned !== undefined) { fields.push('pinned = ?'); vals.push(Number(pinned) ? 1 : 0); }
  if (req.file) { fields.push('photo = ?'); vals.push('/uploads/photos/' + req.file.filename); }
  if (!fields.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE anniversaries SET ${fields.join(',')} WHERE id = ?`, vals);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM anniversaries WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
