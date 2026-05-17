const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { makeUploader } = require('../middleware/upload');
const router = express.Router();
const upload = makeUploader('photos');

router.get('/', requireAuth, async (req, res) => {
  const [[o]] = await pool.query('SELECT * FROM origin WHERE id = 1');
  const [photos] = await pool.query(
    `SELECT p.*, u.role AS author_role FROM photos p
     LEFT JOIN users u ON u.id = p.author_id
     WHERE p.category = 'origin' ORDER BY p.created_at DESC`
  );
  res.json({ origin: o, photos });
});

router.put('/', requireAuth, async (req, res) => {
  const { meet_date, first_match, boy_character, girl_character, story } = req.body;
  await pool.query(
    `UPDATE origin SET
       meet_date = COALESCE(?, meet_date),
       first_match = COALESCE(?, first_match),
       boy_character = COALESCE(?, boy_character),
       girl_character = COALESCE(?, girl_character),
       story = COALESCE(?, story)
     WHERE id = 1`,
    [meet_date || null, first_match ?? null, boy_character ?? null, girl_character ?? null, story ?? null]
  );
  res.json({ ok: true });
});

router.post('/photos', requireAuth, upload.array('files', 30), async (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ error: '请选择照片' });
  const inserts = req.files.map(f => [
    '/uploads/photos/' + f.filename, req.body.remark || '', req.session.userId, null, 'origin', null
  ]);
  await pool.query(
    'INSERT INTO photos (path,remark,author_id,taken_at,category,album_id) VALUES ?',
    [inserts]
  );
  res.json({ ok: true });
});

module.exports = router;
