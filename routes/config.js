const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { makeUploader } = require('../middleware/upload');
const router = express.Router();
const upload = makeUploader('backgrounds');

router.get('/', requireAuth, async (req, res) => {
  const [[cfg]] = await pool.query('SELECT * FROM site_config WHERE id = 1');
  const [[pref]] = await pool.query('SELECT * FROM user_prefs WHERE user_id = ?', [req.session.userId]);
  res.json({ config: cfg, pref: pref || { blur: 0, opacity: 86 } });
});

router.put('/', requireAuth, async (req, res) => {
  const { love_start_date, footer_text } = req.body;
  await pool.query(
    `UPDATE site_config SET
       love_start_date = COALESCE(?, love_start_date),
       footer_text = COALESCE(?, footer_text) WHERE id = 1`,
    [love_start_date || null, footer_text || null]
  );
  res.json({ ok: true });
});

router.post('/background', requireAuth, upload.single('file'), async (req, res) => {
  const { slot } = req.body; // boy_bg | girl_bg | both_bg
  if (!['boy_bg', 'girl_bg', 'both_bg'].includes(slot)) return res.status(400).json({ error: 'slot 无效' });
  if (!req.file) return res.status(400).json({ error: '请上传背景图' });
  const url = '/uploads/backgrounds/' + req.file.filename;
  await pool.query(`UPDATE site_config SET ${slot} = ? WHERE id = 1`, [url]);
  res.json({ ok: true, url });
});

router.delete('/background/:slot', requireAuth, async (req, res) => {
  const slot = req.params.slot;
  if (!['boy_bg', 'girl_bg', 'both_bg'].includes(slot)) return res.status(400).json({ error: 'slot 无效' });
  await pool.query(`UPDATE site_config SET ${slot} = '' WHERE id = 1`);
  res.json({ ok: true });
});

router.put('/pref', requireAuth, async (req, res) => {
  const { blur = 0, opacity = 100 } = req.body;
  await pool.query(
    `INSERT INTO user_prefs (user_id, blur, opacity) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE blur = VALUES(blur), opacity = VALUES(opacity)`,
    [req.session.userId, blur, opacity]
  );
  res.json({ ok: true });
});

module.exports = router;
