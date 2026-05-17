const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password, remember } = req.body;
  if (!username || !password) return res.status(400).json({ error: '账号或密码有误，请重新输入' });
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  if (!rows.length) return res.status(401).json({ error: '账号或密码有误，请重新输入' });
  const u = rows[0];
  const ok = await bcrypt.compare(password, u.password);
  if (!ok) return res.status(401).json({ error: '账号或密码有误，请重新输入' });
  req.session.userId = u.id;
  req.session.role = u.role;
  if (remember) req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 90;
  await pool.query('UPDATE users SET last_seen = NOW() WHERE id = ?', [u.id]);
  const welcome = u.role === 'boy'
    ? '漆黑烈焰使，欢迎回到专属羁绊空间 🦈🔥'
    : '邪王真眼使，欢迎回到专属羁绊空间 🐝👁️';
  res.json({ ok: true, message: welcome, user: { id: u.id, username: u.username, role: u.role, nickname: u.nickname } });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', requireAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT id,username,role,nickname FROM users WHERE id = ?', [req.session.userId]);
  if (!rows.length) return res.status(401).json({ error: '未登录' });
  res.json({ user: rows[0] });
});

router.put('/profile', requireAuth, async (req, res) => {
  const { username, nickname } = req.body;
  if (username !== undefined) {
    const u = String(username).trim();
    if (!u || u.length < 2 || u.length > 40) return res.status(400).json({ error: '账号名 2-40 个字符' });
    if (!/^[A-Za-z0-9_.\-]+$/.test(u)) return res.status(400).json({ error: '账号名仅支持字母、数字、下划线、点、短横线' });
    const [exist] = await pool.query('SELECT id FROM users WHERE username = ? AND id <> ?', [u, req.session.userId]);
    if (exist.length) return res.status(400).json({ error: '该账号名已被另一半占用啦~换一个吧' });
    await pool.query('UPDATE users SET username = ? WHERE id = ?', [u, req.session.userId]);
  }
  if (nickname !== undefined) {
    const n = String(nickname).trim();
    if (!n || n.length > 60) return res.status(400).json({ error: '昵称长度需要 1-60 字' });
    await pool.query('UPDATE users SET nickname = ? WHERE id = ?', [n, req.session.userId]);
  }
  const [[u]] = await pool.query('SELECT id,username,role,nickname FROM users WHERE id = ?', [req.session.userId]);
  res.json({ ok: true, user: u });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: '新密码至少 4 位' });
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
  const ok = await bcrypt.compare(oldPassword || '', rows[0].password);
  if (!ok) return res.status(400).json({ error: '原密码不正确' });
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, req.session.userId]);
  res.json({ ok: true });
});

module.exports = router;
