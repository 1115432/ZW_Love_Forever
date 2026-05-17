const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { makeUploader } = require('../middleware/upload');
const router = express.Router();
const upload = makeUploader('photos');

router.get('/', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT t.*, c.role AS creator_role, c.nickname AS creator_nickname,
            f.role AS confirmer_role, f.nickname AS confirmer_nickname
     FROM todos t
     LEFT JOIN users c ON c.id = t.creator_id
     LEFT JOIN users f ON f.id = t.confirmer_id
     ORDER BY t.pinned DESC, FIELD(t.status,'doing','pending','done'), t.due_date ASC, t.id DESC`
  );
  const [[stat]] = await pool.query(
    `SELECT
       SUM(status='pending') AS pending,
       SUM(status='doing') AS doing,
       SUM(status='done') AS done,
       COUNT(*) AS total FROM todos`
  );
  res.json({ list: rows, stat });
});

router.post('/', requireAuth, async (req, res) => {
  const { title, remark = '', category = 'daily', due_date = null } = req.body;
  if (!title) return res.status(400).json({ error: '请填写心愿标题' });
  const [r] = await pool.query(
    'INSERT INTO todos (title,remark,category,due_date,creator_id) VALUES (?,?,?,?,?)',
    [title, remark, category, due_date || null, req.session.userId]
  );
  res.json({ ok: true, id: r.insertId });
});

router.put('/:id', requireAuth, upload.single('photo'), async (req, res) => {
  const { title, remark, category, status, due_date, pinned, reflection } = req.body;
  const fields = [], vals = [];
  const map = { title, remark, category, reflection };
  Object.entries(map).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k} = ?`); vals.push(v); } });
  if (due_date !== undefined) { fields.push('due_date = ?'); vals.push(due_date || null); }
  if (pinned !== undefined) { fields.push('pinned = ?'); vals.push(Number(pinned) ? 1 : 0); }
  if (status !== undefined) {
    fields.push('status = ?'); vals.push(status);
    if (status === 'done') {
      fields.push('done_at = NOW()');
      fields.push('confirmer_id = ?'); vals.push(req.session.userId);
      fields.push('reject_reason = NULL, rejected_at = NULL');
    }
  }
  if (req.file) { fields.push('photo = ?'); vals.push('/uploads/photos/' + req.file.filename); }
  if (!fields.length) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(`UPDATE todos SET ${fields.join(',')} WHERE id = ?`, vals);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const [[t]] = await pool.query('SELECT creator_id FROM todos WHERE id = ?', [req.params.id]);
  if (!t) return res.status(404).json({ error: '该心愿已不在了' });
  if (t.creator_id !== req.session.userId) {
    return res.status(403).json({ error: '只有发起人可以删除这件心愿，对方可以选择 拒绝完成 哦~' });
  }
  await pool.query('DELETE FROM todos WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// 对方拒绝完成（带理由），仅在已完成或进行中时可用，且操作者必须不是发起人
router.post('/:id/reject', requireAuth, async (req, res) => {
  const { reason = '' } = req.body;
  if (!reason.trim()) return res.status(400).json({ error: '请填写拒绝理由，让对方知道你的想法' });
  const [[t]] = await pool.query('SELECT * FROM todos WHERE id = ?', [req.params.id]);
  if (!t) return res.status(404).json({ error: '该心愿已不在了' });
  if (t.creator_id === req.session.userId) {
    return res.status(403).json({ error: '不能拒绝自己发起的心愿~' });
  }
  await pool.query(
    `UPDATE todos SET status = 'doing', done_at = NULL, confirmer_id = NULL,
       reject_reason = ?, rejected_at = NOW() WHERE id = ?`,
    [reason.trim(), req.params.id]
  );
  res.json({ ok: true });
});

module.exports = router;
