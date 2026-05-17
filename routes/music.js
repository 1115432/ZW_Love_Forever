const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

/**
 * 33ve.com（闪闪音乐网）适配
 * 搜索：GET https://www.33ve.com/so/{kw}.html  → HTML，提取 /mp3/{hash}.html 链接
 * 详情元数据：POST /style/js/play.php  body: id=<hash>&type=mp3  → JSON {pic, lrc, title, name, singer}
 * MP3 直链：GET /plug/down.php?ac=music&id=<hash>  → 302 → 酷狗 CDN 真实 mp3
 */
const SITE = 'https://www.33ve.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function ve(url, init = {}) {
  return fetch(url, {
    ...init,
    headers: {
      'User-Agent': UA,
      Referer: SITE + '/',
      ...(init.headers || {}),
    },
  });
}

// 搜索：解析 HTML 列表
router.get('/search', requireAuth, async (req, res) => {
  const kw = String(req.query.kw || '').trim();
  if (!kw) return res.json({ list: [] });
  try {
    const r = await ve(`${SITE}/so/${encodeURIComponent(kw)}.html`);
    if (!r.ok) return res.status(502).json({ error: '搜索服务暂时不可用，稍后再试' });
    const html = await r.text();
    const seen = new Set();
    const list = [];
    // <a href="/mp3/{hash}.html"...>Artist - Title</a>
    const re = /<a\s+href="\/mp3\/([a-f0-9]{32})\.html"[^>]*>\s*([^<]+?)\s*<\/a>/g;
    let m;
    while ((m = re.exec(html)) !== null && list.length < 30) {
      const id = m[1];
      const text = m[2].replace(/&nbsp;|\s+/g, ' ').trim();
      if (!text || seen.has(id)) continue;
      seen.add(id);
      const dash = text.indexOf(' - ');
      const artist = dash > 0 ? text.slice(0, dash).trim() : '';
      const name = dash > 0 ? text.slice(dash + 3).trim() : text;
      list.push({ id, name, artist, pic: '' });
    }
    res.json({ list });
  } catch (e) {
    res.status(502).json({ error: '搜索失败：' + e.message });
  }
});

// 解析单首歌：拿元信息 + 真实 mp3 直链
router.get('/resolve', requireAuth, async (req, res) => {
  const id = String(req.query.id || '').trim();
  if (!/^[a-f0-9]{32}$/.test(id)) return res.status(400).json({ error: '无效的 id' });
  try {
    const detailRef = `${SITE}/mp3/${id}.html`;

    // 1. 元信息（pic / lrc / title / singer）
    const metaP = ve(`${SITE}/style/js/play.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: detailRef,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: `id=${id}&type=mp3`,
    }).then(r => r.json()).catch(() => ({}));

    // 2. 真实 mp3 直链（跟随 302 拿 Location）
    const urlP = ve(`${SITE}/plug/down.php?ac=music&id=${id}`, {
      redirect: 'manual',
      headers: { Referer: `${SITE}/down.php?ac=music&id=${id}` },
    }).then(r => r.headers.get('location') || '').catch(() => '');

    const [meta, audioUrl] = await Promise.all([metaP, urlP]);

    if (!audioUrl) {
      return res.status(404).json({ error: '这首歌的资源已被版权方删除或暂时无法获取，换一首试试~' });
    }

    res.json({
      id,
      url: audioUrl,
      cover: meta.pic || '',
      lrc: meta.lrc || '',
      name: meta.name || '',
      artist: meta.singer || '',
    });
  } catch (e) {
    res.status(502).json({ error: '解析失败：' + e.message });
  }
});

// 获取共享播放状态
router.get('/state', requireAuth, async (req, res) => {
  const [[s]] = await pool.query(
    `SELECT m.*, u.nickname AS updater_nickname, u.role AS updater_role
       FROM music_state m LEFT JOIN users u ON u.id = m.updated_by WHERE m.id = 1`
  );
  res.json({ state: s || null });
});

// 更新共享播放状态
router.put('/state', requireAuth, async (req, res) => {
  const { song_id, song_name, artist, cover, lrc, position, is_playing } = req.body || {};
  const seq = Date.now();
  await pool.query(
    `UPDATE music_state SET
       song_id = COALESCE(?, song_id),
       song_name = COALESCE(?, song_name),
       artist = COALESCE(?, artist),
       cover = COALESCE(?, cover),
       lrc = COALESCE(?, lrc),
       position = COALESCE(?, position),
       is_playing = COALESCE(?, is_playing),
       action_seq = ?,
       updated_by = ?
     WHERE id = 1`,
    [
      song_id ?? null,
      song_name ?? null,
      artist ?? null,
      cover ?? null,
      lrc ?? null,
      position ?? null,
      is_playing == null ? null : (is_playing ? 1 : 0),
      seq,
      req.session.userId,
    ]
  );
  res.json({ ok: true, action_seq: seq });
});

module.exports = router;
