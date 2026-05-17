require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const { pool, initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 5200;

// Ensure upload folders
const uploadDirs = ['uploads', 'uploads/photos', 'uploads/backgrounds', 'uploads/avatars'];
uploadDirs.forEach(d => {
  const p = path.join(__dirname, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'love-forever-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 30 } // 30 days
}));

// Static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Online status middleware: update last_seen when authenticated
app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      await pool.query('UPDATE users SET last_seen = NOW() WHERE id = ?', [req.session.userId]);
    } catch (e) { /* ignore */ }
  }
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/status', require('./routes/status'));
app.use('/api/config', require('./routes/config'));
app.use('/api/anniversaries', require('./routes/anniversaries'));
app.use('/api/photos', require('./routes/photos'));
app.use('/api/albums', require('./routes/albums'));
app.use('/api/todos', require('./routes/todos'));
app.use('/api/travels', require('./routes/travels'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/diaries', require('./routes/diaries'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/capsules', require('./routes/capsules'));
app.use('/api/origin', require('./routes/origin'));
app.use('/api/home', require('./routes/home'));
app.use('/api/music', require('./routes/music'));

// 404
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: '该羁绊路径还未开启哦~' });
  }
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

(async () => {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`\n🦈🐝 Love Forever 已启动: http://localhost:${PORT}`);
      console.log(`漆黑烈焰使 × 邪王真眼使，鲨鱼与蜜蜂的永恒羁绊\n`);
    });
  } catch (e) {
    console.error('启动失败:', e);
    process.exit(1);
  }
})();
