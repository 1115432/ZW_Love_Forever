const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const [[cfg]] = await pool.query('SELECT * FROM site_config WHERE id = 1');

  // Upcoming anniversaries (next 60 days)
  const [annivs] = await pool.query(
    `SELECT *,
       DATEDIFF(DATE_ADD(date, INTERVAL (YEAR(CURDATE())-YEAR(date)) YEAR), CURDATE()) AS diff_raw
     FROM anniversaries ORDER BY date ASC`
  );
  const today = new Date();
  const upcoming = annivs.map(a => {
    const d = new Date(a.date);
    let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
    }
    const days = Math.round((next - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
    return { ...a, days_until: days };
  }).sort((a, b) => a.days_until - b.days_until).slice(0, 5);

  // Latest activity per partner
  const [[latestDiary]] = await pool.query(
    `SELECT d.id, d.content, d.created_at, d.diary_date, u.role FROM diaries d
     LEFT JOIN users u ON u.id = d.author_id WHERE d.is_draft = 0
     ORDER BY COALESCE(d.diary_date, d.created_at) DESC, d.created_at DESC LIMIT 1`
  );
  const [[latestPhoto]] = await pool.query(
    `SELECT p.id, p.path, p.created_at, u.role FROM photos p
     LEFT JOIN users u ON u.id = p.author_id ORDER BY p.created_at DESC LIMIT 1`
  );
  const [[latestTodo]] = await pool.query(
    `SELECT t.id, t.title, t.created_at, u.role FROM todos t
     LEFT JOIN users u ON u.id = t.creator_id ORDER BY t.created_at DESC LIMIT 1`
  );

  // Random sweet snippet
  const [[randDiary]] = await pool.query(
    `SELECT id, content, created_at, diary_date FROM diaries WHERE is_draft = 0 ORDER BY RAND() LIMIT 1`
  );
  const [[randPhoto]] = await pool.query(`SELECT id, path, remark FROM photos ORDER BY RAND() LIMIT 1`);

  res.json({
    config: cfg,
    upcoming,
    latest: { diary: latestDiary || null, photo: latestPhoto || null, todo: latestTodo || null },
    random: { diary: randDiary || null, photo: randPhoto || null }
  });
});

module.exports = router;
