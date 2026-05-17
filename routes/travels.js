const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { makeUploader } = require('../middleware/upload');
const router = express.Router();
const upload = makeUploader('photos');

router.get('/', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT t.*, u.role AS author_role, u.nickname AS author_nickname,
     (SELECT COUNT(*) FROM travel_media tm WHERE tm.travel_id = t.id) AS media_count
     FROM travels t LEFT JOIN users u ON u.id = t.author_id
     ORDER BY t.pinned DESC, FIELD(t.status,'want','done'), t.plan_date ASC, t.id DESC`
  );
  res.json({ list: rows });
});

router.get('/:id/media', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM travel_media WHERE travel_id = ? ORDER BY created_at DESC',
    [req.params.id]
  );
  res.json({ list: rows });
});

router.post('/:id/media', requireAuth, upload.array('files', 20), async (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ error: '请选择文件' });
  const { remark = '' } = req.body;
  const inserts = req.files.map(f => {
    const ext = f.originalname.toLowerCase();
    const mediaType = ext.match(/\.(mp4|webm|mov|avi)$/i) ? 'video' : 'image';
    return [
      req.params.id,
      '/uploads/photos/' + f.filename,
      mediaType,
      remark
    ];
  });
  await pool.query(
    'INSERT INTO travel_media (travel_id, path, media_type, remark) VALUES ?',
    [inserts]
  );
  res.json({ ok: true, count: inserts.length });
});

router.delete('/:id/media/:mediaId', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM travel_media WHERE id = ? AND travel_id = ?', [req.params.mediaId, req.params.id]);
  res.json({ ok: true });
});

router.post('/', requireAuth, upload.single('cover'), async (req, res) => {
  const { name, reason = '', tag = 'short', plan_date = null, cover_selected = '' } = req.body;
  if (!name) return res.status(400).json({ error: '请填写地点名称' });
  const cover = req.file ? '/uploads/photos/' + req.file.filename : cover_selected;
  const [r] = await pool.query(
    'INSERT INTO travels (name,reason,tag,plan_date,cover,author_id) VALUES (?,?,?,?,?,?)',
    [name, reason, tag, plan_date || null, cover, req.session.userId]
  );
  res.json({ ok: true, id: r.insertId });
});

router.put('/:id', requireAuth, upload.single('cover'), async (req, res) => {
  const { name, reason, tag, plan_date, status, pinned, cover_selected } = req.body;
  const fields = [], vals = [];
  const map = { name, reason, tag };
  Object.entries(map).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = ?`); vals.push(v); } });
  if (plan_date !== undefined) { fields.push('plan_date = ?'); vals.push(plan_date || null); }
  if (pinned !== undefined) { fields.push('pinned = ?'); vals.push(Number(pinned) ? 1 : 0); }
  if (status !== undefined) {
    fields.push('status = ?'); vals.push(status);
    if (status === 'done') fields.push('done_at = NOW()');
  }
  if (req.file) { fields.push('cover = ?'); vals.push('/uploads/photos/' + req.file.filename); }
  else if (cover_selected !== undefined) { fields.push('cover = ?'); vals.push(cover_selected); }
  if (!fields.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE travels SET ${fields.join(',')} WHERE id = ?`, vals);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM travels WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
