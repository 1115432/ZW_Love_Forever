const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const ONLINE_WINDOW_SECONDS = 60;

router.post('/heartbeat', requireAuth, async (req, res) => {
  await pool.query('UPDATE users SET last_seen = NOW() WHERE id = ?', [req.session.userId]);
  res.json({ ok: true });
});

router.get('/online', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, role, nickname, last_seen,
       (TIMESTAMPDIFF(SECOND, last_seen, NOW()) <= ?) AS online
     FROM users`,
    [ONLINE_WINDOW_SECONDS]
  );
  const map = { boy: null, girl: null };
  rows.forEach(r => { map[r.role] = { ...r, online: !!r.online }; });
  const both = map.boy?.online && map.girl?.online;
  const state = both ? 'both' : (map.boy?.online ? 'boy' : (map.girl?.online ? 'girl' : 'none'));
  res.json({ users: map, state, text: both ? '二人同栖' : (state === 'none' ? '暂无在线' : '独自一人') });
});

module.exports = router;
