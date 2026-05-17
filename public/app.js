/* ===== Love Forever SPA ===== */
const App = {
  user: null,
  config: null,
  pref: { blur: 0, opacity: 100 },
  online: { state: 'none', users: {} },
  loveStart: null,
  heartbeatTimer: null,
  loveTimer: null,
};

/* ---------- API helper ---------- */
async function api(url, opts = {}) {
  const o = { credentials: 'same-origin', ...opts };
  if (o.body && !(o.body instanceof FormData)) {
    o.headers = { 'Content-Type': 'application/json', ...(o.headers || {}) };
    if (typeof o.body !== 'string') o.body = JSON.stringify(o.body);
  }
  const r = await fetch(url, o);
  if (r.status === 401) { location.href = '/login.html'; throw new Error('未登录'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || '操作失败');
  return data;
}

/* ---------- Utilities ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const el = (tag, attrs = {}, children = []) => {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') e.innerHTML = v;
    else if (v !== false && v != null) e.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null || c === false) return;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return e;
};
const fmtDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x)) return d;
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
};
const fmtDateTime = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x)) return d;
  return `${fmtDate(d)} ${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`;
};
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function toLocalDateTimeValue(d) {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x)) return '';
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
}
async function compressImageFile(file, maxSide = 1280, quality = 0.72) {
  if (!file.type.startsWith('image/') || /gif|svg/i.test(file.type) || file.size < 250 * 1024) return file;
  const bitmap = await loadImageBitmap(file);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let blob = null;
  for (const q of [quality, 0.66, 0.58]) {
    blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', q));
    if (blob && blob.size <= Math.min(file.size * 0.85, 1200 * 1024)) break;
  }
  if (!blob || blob.size >= file.size) return file;
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
}
async function loadImageBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (bitmap) return bitmap;
  }
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
async function buildUploadFormData(form, extra = {}, onProgress) {
  const fd = new FormData();
  for (const el of Array.from(form.elements)) {
    if (!el.name || el.disabled || el.type === 'file') continue;
    if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) continue;
    fd.append(el.name, el.value);
  }
  Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
  const fileItems = Array.from(form.querySelectorAll('input[type="file"][name]')).flatMap(input =>
    Array.from(input.files || []).map(file => ({ name: input.name, file }))
  );
  for (let i = 0; i < fileItems.length; i++) {
    const msg = `正在压缩图片 ${i + 1}/${fileItems.length}…`;
    if (onProgress) onProgress(msg);
    toast(msg);
    fd.append(fileItems[i].name, await compressImageFile(fileItems[i].file));
  }
  return fd;
}
function imageAttrs(attrs = {}) {
  return { loading: 'lazy', decoding: 'async', ...attrs };
}
/* ----- 小狗头像系统：金毛=男生、小白狗=女生 ----- */
const MASCOT = {
  boy: ['/assets/mascots/boy-1.png', '/assets/mascots/boy-2.png'],
  girl: ['/assets/mascots/girl-1.png', '/assets/mascots/girl-2.png'],
};
const FALLBACK_EMOJI = { boy: '🐕', girl: '🐩', any: '🐶' };
function mascotUrl(role, idx = 0) {
  const arr = MASCOT[role] || [...MASCOT.boy, ...MASCOT.girl];
  return arr[((idx % arr.length) + arr.length) % arr.length];
}
function randomMascotUrl(role) {
  const arr = role && MASCOT[role] ? MASCOT[role] : [...MASCOT.boy, ...MASCOT.girl];
  return arr[Math.floor(Math.random() * arr.length)];
}
function mascotImgHtml(role, cls = 'mascot') {
  const src = mascotUrl(role, 0);
  const fb = FALLBACK_EMOJI[role] || FALLBACK_EMOJI.any;
  return `<img class="${cls}" src="${src}" alt="" onerror="this.outerHTML='<span class=\\'${cls}-fallback\\'>${fb}</span>'">`;
}
function roleEmblem(role) {
  if (role !== 'boy' && role !== 'girl') return '';
  const cls = role === 'boy' ? 'boy' : 'girl';
  const label = role === 'boy' ? '漆黑烈焰使' : '邪王真眼使';
  return `<span class="tag ${cls}">${mascotImgHtml(role, 'mascot')} ${label}</span>`;
}
function roleIcon(role) {
  if (role !== 'boy' && role !== 'girl') return FALLBACK_EMOJI.any;
  return mascotImgHtml(role, 'mascot');
}
function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}
function confirmDialog(text) {
  return new Promise(resolve => {
    showModal({
      title: '确认操作',
      body: el('p', { style: { lineHeight: 1.6 } }, text),
      okText: '确定',
      onOk: () => { closeModal(); resolve(true); },
      onCancel: () => { closeModal(); resolve(false); }
    });
  });
}

/* ---------- Modal ---------- */
function showModal({ title, body, okText = '保存', cancelText = '取消', pendingText = '处理中…', onOk, onCancel }) {
  const root = $('#modalRoot');
  root.innerHTML = '';
  let pending = false;
  const mask = el('div', { class: 'modal-mask', onclick: (e) => { if (e.target === mask) (onCancel || closeModal)(); } });
  const modal = el('div', { class: 'modal' });
  modal.appendChild(el('h3', {}, title));
  if (typeof body === 'string') modal.insertAdjacentHTML('beforeend', body);
  else if (body) modal.appendChild(body);
  const cancelBtn = el('button', { class: 'btn', onclick: () => { if (!pending) (onCancel || closeModal)(); } }, cancelText);
  const okBtn = el('button', { class: 'btn primary', onclick: async () => {
    if (!onOk || pending) return;
    pending = true;
    okBtn.disabled = true;
    cancelBtn.disabled = true;
    okBtn.textContent = pendingText;
    try {
      const result = await onOk();
      if (result === false) throw new Error('');
    } catch (e) {
      pending = false;
      okBtn.disabled = false;
      cancelBtn.disabled = false;
      okBtn.textContent = okText;
      if (e.message) toast(e.message);
    }
  } }, okText);
  const foot = el('div', { class: 'modal-foot' }, [
    cancelBtn,
    okBtn,
  ]);
  modal.appendChild(foot);
  mask.appendChild(modal);
  root.appendChild(mask);
}
function closeModal() { $('#modalRoot').innerHTML = ''; }

/* ---------- Lightbox ---------- */
function lightbox(src, gallery, startIdx) {
  const srcs = Array.isArray(gallery) && gallery.length ? gallery : [src];
  let idx = typeof startIdx === 'number' ? startIdx : Math.max(0, srcs.indexOf(src));
  if (idx < 0) idx = 0;
  let rotation = 0;

  const img = el('img', { src: srcs[idx] });
  const counter = el('span', { class: 'lb-counter' }, srcs.length > 1 ? `${idx + 1} / ${srcs.length}` : '');

  const update = () => {
    img.src = srcs[idx];
    rotation = 0;
    img.style.transform = '';
    counter.textContent = srcs.length > 1 ? `${idx + 1} / ${srcs.length}` : '';
  };

  const prev = () => { if (srcs.length > 1) { idx = (idx - 1 + srcs.length) % srcs.length; update(); } };
  const next = () => { if (srcs.length > 1) { idx = (idx + 1) % srcs.length; update(); } };
  const rotateL = () => { rotation = (rotation - 90 + 360) % 360; img.style.transform = `rotate(${rotation}deg)`; };
  const rotateR = () => { rotation = (rotation + 90) % 360; img.style.transform = `rotate(${rotation}deg)`; };

  const lb = el('div', { class: 'lightbox', onclick: (e) => { if (e.target === lb) lb.remove(); } }, [
    el('button', { class: 'lb-close', onclick: () => lb.remove() }, '×'),
    srcs.length > 1 ? el('button', { class: 'lb-nav lb-prev', onclick: (e) => { e.stopPropagation(); prev(); } }, '‹') : null,
    img,
    srcs.length > 1 ? el('button', { class: 'lb-nav lb-next', onclick: (e) => { e.stopPropagation(); next(); } }, '›') : null,
    el('div', { class: 'lb-toolbar' }, [
      el('button', { class: 'lb-tool', onclick: (e) => { e.stopPropagation(); rotateL(); }, title: '左旋' }, '⟲'),
      el('button', { class: 'lb-tool', onclick: (e) => { e.stopPropagation(); rotateR(); }, title: '右旋' }, '⟳'),
      counter,
    ]),
  ]);

  const onKey = (e) => {
    if (e.key === 'Escape') { lb.remove(); }
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'r') rotateR();
    else if (e.key === 'R') rotateL();
  };
  document.addEventListener('keydown', onKey);
  const obs = new MutationObserver(() => { if (!document.body.contains(lb)) { document.removeEventListener('keydown', onKey); obs.disconnect(); } });
  obs.observe(document.body, { childList: true });

  document.body.appendChild(lb);
}

/* ---------- Auth & Bootstrap ---------- */
async function bootstrap() {
  try {
    const me = await api('/api/auth/me');
    App.user = me.user;
    refreshMeBadge();
  } catch (e) {
    location.href = '/login.html'; return;
  }
  await loadConfig();
  await refreshOnline();
  App.heartbeatTimer = setInterval(refreshOnline, 15000);
  bindGlobalEvents();
  window.addEventListener('hashchange', route);
  route();
  checkPendingCapsules();
}

async function loadConfig() {
  const { config, pref } = await api('/api/config');
  App.config = config;
  App.pref = pref || { blur: 0, opacity: 100 };
  App.loveStart = config.love_start_date;
  if (config.footer_text) $('#footerText').textContent = config.footer_text;
  applyBackground();
}

function applyBackground() {
  if (!App.config) return;
  let url = '';
  const s = App.online.state;
  if (s === 'both' && App.config.both_bg) url = App.config.both_bg;
  else if (s === 'boy' && App.config.boy_bg) url = App.config.boy_bg;
  else if (s === 'girl' && App.config.girl_bg) url = App.config.girl_bg;
  else url = App.config.both_bg || App.config.boy_bg || App.config.girl_bg || '';
  const layer = $('#bgLayer');
  layer.style.backgroundImage = url ? `url("${url}")` : 'linear-gradient(135deg, #fce8ee, #d9ecf7)';
  layer.style.filter = `blur(${App.pref.blur || 0}px)`;
  // 不透明度作用于操作面板（卡片/侧栏/顶栏），背景保持完整可见
  const op = (App.pref.opacity ?? 86) / 100;
  document.documentElement.style.setProperty('--panel-opacity', op.toFixed(2));
}

async function refreshOnline() {
  try {
    const data = await api('/api/status/online');
    App.online = data;
    const pill = $('#onlineState');
    pill.className = 'online-pill ' + data.state;
    pill.textContent = `当前在线 · ${data.text}`;
    applyBackground();
    // heartbeat (don't await on slow)
    fetch('/api/status/heartbeat', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
  } catch (e) {}
}

function refreshMeBadge() {
  if (!App.user) return;
  const role = App.user.role;
  $('#meBadge').innerHTML = `${mascotImgHtml(role, 'mascot')} <span style="margin-left:4px">${escapeHtml(App.user.nickname || App.user.username)}</span>`;
  // 顶栏品牌：男生 + 女生头像
  const brand = document.querySelector('.brand-emblem');
  if (brand) brand.innerHTML = `${mascotImgHtml('boy','mascot')}${mascotImgHtml('girl','mascot')}`;
}

function bindGlobalEvents() {
  $('#logoutBtn').onclick = async () => {
    if (!await confirmDialog('确定要离开庄园吗？羁绊会一直在这里等你哦~')) return;
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/login.html';
  };
  $('#navToggle').onclick = () => $('#sidebar').classList.toggle('open');
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 900 && !e.target.closest('#sidebar') && !e.target.closest('#navToggle')) {
      $('#sidebar').classList.remove('open');
    }
  });
}

/* ---------- Router ---------- */
const ROUTES = {
  home: pageHome,
  anniversaries: pageAnniversaries,
  timeline: pageTimeline,
  albums: pageAlbums,
  diaries: pageDiaries,
  messages: pageMessages,
  todos: pageTodos,
  travels: pageTravels,
  capsules: pageCapsules,
  music: pageMusic,
  origin: pageOrigin,
  settings: pageSettings,
};
function route() {
  const hash = location.hash.replace(/^#\//, '') || 'home';
  const [name, ...rest] = hash.split('/');
  const fn = ROUTES[name] || pageHome;
  $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.route === name));
  const app = $('#app');
  app.innerHTML = `<div class="empty"><img class="doge-img" src="${randomMascotUrl()}" onerror="this.outerHTML='<div class=\'doge\'>🐶</div>'">正在打开庄园通道…</div>`;
  Promise.resolve(fn(app, rest)).catch(e => {
    app.innerHTML = '';
    app.appendChild(emptyBox('加载失败：' + (e.message || '未知错误')));
  });
}

/* ============================================================
   PAGES
   ============================================================ */

/* -------- Home -------- */
async function pageHome(app) {
  const data = await api('/api/home');
  app.innerHTML = '';
  // counter
  const counter = el('div', { class: 'love-counter card' }, [
    el('div', { class: 'lc-title' }, '我们的羁绊已持续'),
    el('div', { class: 'lc-main', id: 'loveDays' }, '— 天'),
    el('div', { class: 'lc-clock', id: 'loveClock' }, '00:00:00'),
    el('div', { class: 'lc-sub' }, `🦈 漆黑烈焰使 × 🐝 邪王真眼使 · 始于 ${fmtDate(App.loveStart)}`),
  ]);
  app.appendChild(counter);
  startLoveTimer();

  // shortcuts
  const shortcuts = [
    ['anniversaries', '🎂', '纪念日'],
    ['timeline', '📸', '照片墙'],
    ['diaries', '📔', '恋爱日记'],
    ['todos', '✅', '未做之事'],
    ['travels', '🗺️', '期待旅行'],
    ['origin', '🎭', '庄园缘起'],
    ['capsules', '⏳', '时光胶囊'],
    ['messages', '💌', '悄悄话'],
  ];
  const sc = el('div', { class: 'card' }, [
    el('h3', { style: { margin: '0 0 10px' } }, '快捷入口'),
    el('div', { class: 'shortcut-grid' },
      shortcuts.map(([r, ic, lb]) =>
        el('a', { class: 'shortcut', href: '#/' + r }, [
          el('div', { class: 'ic' }, ic),
          el('div', { class: 'lb' }, lb),
        ])
      )
    )
  ]);
  app.appendChild(sc);

  // Upcoming anniversaries
  const upCard = el('div', { class: 'card' }, [
    el('h3', { style: { margin: '0 0 10px' } }, '近期纪念日'),
  ]);
  if (!data.upcoming.length) {
    upCard.appendChild(emptyBox('庄园相遇的回忆未完，快去添加第一个纪念日'));
  } else {
    const ul = el('div', { class: 'upcoming-list' });
    data.upcoming.forEach(a => {
      ul.appendChild(el('div', { class: 'upcoming-item' + (a.days_until <= 7 ? ' near' : '') }, [
        el('div', {}, [
          el('strong', {}, a.name),
          el('div', { style: { fontSize: '12px', color: 'var(--c-text-soft)', marginTop: '2px' } },
            `${fmtDate(a.date)} ${a.is_lunar ? '· 农历' : ''}`)
        ]),
        el('div', { class: 'days' },
          a.days_until === 0 ? '就是今天 🎉' : `还有 ${a.days_until} 天`)
      ]));
    });
    upCard.appendChild(ul);
  }
  app.appendChild(upCard);

  // Today's dynamic
  const dyn = el('div', { class: 'card' }, [
    el('h3', { style: { margin: '0 0 10px' } }, '今日点滴'),
  ]);
  const items = [];
  if (data.random?.diary) items.push(`📔 翻到一段过往日记："${escapeHtml(data.random.diary.content.slice(0, 50))}…"`);
  if (data.random?.photo) items.push(`📸 想起一张照片：${data.random.photo.remark ? escapeHtml(data.random.photo.remark) : '点开看看回忆吧'}`);
  if (data.latest?.diary) items.push(`✍️ ${roleIcon(data.latest.diary.role)} 最近写下了一篇日记`);
  if (data.latest?.photo) items.push(`🖼️ ${roleIcon(data.latest.photo.role)} 最近上传了新照片`);
  if (data.latest?.todo) items.push(`🌱 ${roleIcon(data.latest.todo.role)} 最近添加了心愿：${escapeHtml(data.latest.todo.title)}`);
  if (!items.length) items.push(`${mascotImgHtml(App.user.role, 'mascot')} 庄园里安静得很，快来创造第一份回忆`);
  items.forEach(t => dyn.appendChild(el('div', { style: { padding: '6px 0', color: 'var(--c-text-soft)' }, html: t })));

  // small photo preview
  if (data.random?.photo) {
    dyn.appendChild(el('img', imageAttrs({
      src: data.random.photo.path, style: { width: '100%', height: '220px', objectFit: 'cover', borderRadius: '10px', marginTop: '10px', cursor: 'zoom-in' },
      onclick: () => lightbox(data.random.photo.path)
    })));
  }
  app.appendChild(dyn);
}

function startLoveTimer() {
  if (App.loveTimer) clearInterval(App.loveTimer);
  const update = () => {
    if (!App.loveStart) return;
    const elDays = $('#loveDays'), elClock = $('#loveClock');
    if (!elDays) { clearInterval(App.loveTimer); return; }
    const start = new Date(App.loveStart);
    const now = new Date();
    const diffMs = now - start;
    if (diffMs < 0) { elDays.textContent = '0 天'; elClock.textContent = '00:00:00'; return; }
    const days = Math.floor(diffMs / 86400000);
    const rest = diffMs % 86400000;
    const h = Math.floor(rest / 3600000);
    const m = Math.floor((rest % 3600000) / 60000);
    const s = Math.floor((rest % 60000) / 1000);
    elDays.textContent = `${days} 天`;
    elClock.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };
  update();
  App.loveTimer = setInterval(update, 1000);
}

/* -------- Anniversaries -------- */
async function pageAnniversaries(app) {
  const { list } = await api('/api/anniversaries');
  app.innerHTML = '';
  app.appendChild(el('div', { class: 'page-title' }, [
    el('span', {}, '🎂 恋爱纪念日'),
    el('small', {}, '相恋、庄园初识、生日、专属时刻'),
  ]));
  app.appendChild(el('div', { class: 'row-end', style: { marginBottom: '12px' } }, [
    el('button', { class: 'btn primary', onclick: () => editAnniversary() }, '+ 添加纪念日'),
  ]));

  const today = new Date(); today.setHours(0,0,0,0);
  if (!list.length) {
    app.appendChild(emptyBox('快为你们的第一个纪念日留个记号吧'));
    return;
  }
  const grid = el('div', { class: 'grid cols-2' });
  list.forEach(a => {
    const d = new Date(a.date);
    let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    if (next < today) next = new Date(today.getFullYear()+1, d.getMonth(), d.getDate());
    const days = Math.round((next - today) / 86400000);
    const years = today.getFullYear() - d.getFullYear() + (next.getFullYear() > today.getFullYear() ? 0 : 0);
    const passedDays = Math.floor((today - d) / 86400000);
    grid.appendChild(el('div', { class: 'card' }, [
      a.photo ? el('img', imageAttrs({ src: a.photo, style: { width: '100%', height: '160px', objectFit: 'cover', borderRadius: '10px', marginBottom: '10px', cursor: 'zoom-in' }, onclick: () => lightbox(a.photo) })) : null,
      el('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center' } }, [
        el('h3', { style: { margin: 0 } }, [
          a.pinned ? el('span', {}, '📌 ') : null,
          document.createTextNode(a.name)
        ]),
        el('span', { class: 'tag' }, a.type),
      ]),
      el('div', { style: { color: 'var(--c-text-soft)', fontSize: '13px', margin: '6px 0' } },
        `${fmtDate(a.date)}${a.is_lunar ? ' · 农历' : ''}`),
      el('div', { style: { fontSize: '15px', color: 'var(--c-pink-deep)', fontWeight: 600 } },
        days === 0 ? '🎉 就是今天！' : `距离下一个 还有 ${days} 天`),
      el('div', { style: { fontSize: '12px', color: 'var(--c-text-soft)', marginTop: '2px' } },
        passedDays >= 0 ? `已度过 ${passedDays} 天` : `还有 ${-passedDays} 天到来`),
      a.remark ? el('p', { style: { marginTop: '8px', lineHeight: 1.6, fontSize: '13px' } }, a.remark) : null,
      el('div', { class: 'row-end', style: { marginTop: '10px' } }, [
        el('button', { class: 'btn small', onclick: () => togglePin('anniversaries', a) }, a.pinned ? '取消置顶' : '置顶'),
        el('button', { class: 'btn small', onclick: () => editAnniversary(a) }, '编辑'),
        el('button', { class: 'btn small danger', onclick: async () => {
          if (await confirmDialog('删除这个纪念日吗？')) { await api('/api/anniversaries/'+a.id, { method:'DELETE' }); toast('已删除'); pageAnniversaries(app); }
        } }, '删除'),
      ]),
    ]));
  });
  app.appendChild(grid);
}

function editAnniversary(a = {}) {
  const form = el('form', { onsubmit: (e) => e.preventDefault() });
  const fields = [
    ['name', '名称', 'text', a.name || ''],
    ['date', '日期', 'date', a.date ? fmtDate(a.date) : ''],
    ['type', '类型', 'select', a.type || 'custom', ['custom:自定义','love:相恋纪念','meet:庄园初识','birthday:生日','first:第一次']],
    ['remind_days', '提前提醒天数', 'number', a.remind_days ?? 7],
    ['is_lunar', '农历日期', 'check', !!a.is_lunar],
    ['remark', '备注故事', 'textarea', a.remark || ''],
    ['photo', '关联照片', 'file', ''],
  ];
  fields.forEach(([n, lb, t, v, opts]) => {
    const row = el('div', { class: 'form-row' });
    row.appendChild(el('label', {}, lb));
    let input;
    if (t === 'textarea') input = el('textarea', { name: n }, v);
    else if (t === 'select') {
      input = el('select', { name: n });
      opts.forEach(o => {
        const [val, lab] = o.split(':');
        const op = el('option', { value: val }, lab);
        if (val === v) op.selected = true;
        input.appendChild(op);
      });
    } else if (t === 'check') {
      input = el('input', { type: 'checkbox', name: n, style: { width: 'auto' } });
      if (v) input.checked = true;
    } else input = el('input', { type: t, name: n, value: v });
    row.appendChild(input);
    form.appendChild(row);
  });
  showModal({
    title: a.id ? '编辑纪念日' : '添加纪念日',
    body: form,
    pendingText: '正在压缩…',
    onOk: async () => {
      const fd = await buildUploadFormData(form);
      fd.set('is_lunar', form.is_lunar.checked ? 1 : 0);
      if (!fd.get('photo')?.size) fd.delete('photo');
      try {
        const url = a.id ? '/api/anniversaries/'+a.id : '/api/anniversaries';
        await api(url, { method: a.id ? 'PUT' : 'POST', body: fd });
        toast('已保存'); closeModal(); route();
      } catch (e) { throw e; }
    }
  });
}

async function togglePin(kind, item) {
  await api(`/api/${kind}/${item.id}`, { method: 'PUT', body: { pinned: item.pinned ? 0 : 1 } });
  toast(item.pinned ? '取消置顶' : '已置顶'); route();
}

/* -------- Timeline -------- */
async function pageTimeline(app) {
  const { groups } = await api('/api/photos/timeline');
  app.innerHTML = '';
  app.appendChild(el('div', { class: 'page-title' }, [
    el('span', {}, '📸 时间线照片墙'),
    el('small', {}, '点滴拼成我们的庄园')
  ]));
  app.appendChild(el('div', { class: 'row-end', style: { marginBottom: '12px' } }, [
    el('button', { class: 'btn primary', onclick: () => uploadPhotoModal() }, '+ 上传照片/视频'),
    el('a', { class: 'btn', href: '#/albums' }, '管理相册 →'),
  ]));
  const keys = Object.keys(groups).sort().reverse();
  if (!keys.length) { app.appendChild(emptyBox('庄园相遇的回忆未完，快去创造新点滴')); return; }
  const tl = el('div', { class: 'timeline alt' });
  
  const allImages = [];
  keys.forEach(yearKey => {
    const yearData = groups[yearKey];
    Object.keys(yearData.months).forEach(monthKey => {
      const monthData = yearData.months[monthKey];
      Object.keys(monthData.days).forEach(dayKey => {
        const dayData = monthData.days[dayKey];
        dayData.items.filter(x => x.media_type === 'image').forEach(p => {
          allImages.push(p);
        });
      });
    });
  });
  
  keys.forEach(yearKey => {
    const yearData = groups[yearKey];
    const yearGroup = el('div', { class: 'tl-group' });
    
    const yearHeader = el('div', { class: 'tl-year-header', style: { 
      cursor: 'pointer', 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      padding: '12px 16px',
      background: 'var(--c-cream-2)',
      borderRadius: '10px',
      marginBottom: '16px',
      fontSize: '18px',
      fontWeight: 600,
      color: '#000'
    }}, [
      el('span', { class: 'collapse-icon', style: { 
        transition: 'transform 0.2s',
        fontSize: '14px'
      }}, '▼'),
      el('span', {}, yearData.label)
    ]);
    
    const yearContent = el('div', { class: 'tl-year-content', style: { 
      marginLeft: '20px'
    }});
    
    const monthKeys = Object.keys(yearData.months).sort().reverse();
    monthKeys.forEach(monthKey => {
      const monthData = yearData.months[monthKey];
      const monthGroup = el('div', { class: 'tl-month-group' });
      
      const monthHeader = el('div', { class: 'tl-month-header', style: {
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        background: 'var(--c-cream-1)',
        borderRadius: '8px',
        marginBottom: '12px',
        fontSize: '16px',
        fontWeight: 500,
        color: '#000'
      }}, [
        el('span', { class: 'collapse-icon', style: {
          transition: 'transform 0.2s',
          fontSize: '12px'
        }}, '▼'),
        el('span', {}, monthData.label)
      ]);
      
      const monthContent = el('div', { class: 'tl-month-content', style: {
        marginLeft: '20px'
      }});
      
      const dayKeys = Object.keys(monthData.days).sort().reverse();
      dayKeys.forEach(dayKey => {
        const dayData = monthData.days[dayKey];
        const dayGroup = el('div', { class: 'tl-day-group' });
        
        const dayHeader = el('div', { class: 'tl-day-header', style: {
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          background: 'var(--c-pink-light)',
          borderRadius: '6px',
          marginBottom: '10px',
          fontSize: '14px',
          fontWeight: 500,
          color: '#000'
        }}, [
          el('span', { class: 'collapse-icon', style: {
            transition: 'transform 0.2s',
            fontSize: '12px'
          }}, '▼'),
          el('span', {}, dayData.label)
        ]);
        
        const dayContent = el('div', { class: 'tl-items' });
        dayData.items.forEach((p, pi) => {
          const isVideo = p.media_type === 'video';
          const mediaEl = isVideo 
            ? el('video', { src: p.path, controls: true, style: { width: '100%', height: '200px', objectFit: 'cover', borderRadius: '10px' } })
            : el('img', imageAttrs({ src: p.path, onclick: () => lightbox(p.path, allImages.map(x => x.path), allImages.indexOf(p)), style: { width: '100%', height: 'auto', borderRadius: '10px', cursor: 'zoom-in' } }));
          
          dayContent.appendChild(el('div', { class: 'tl-card' }, [
            mediaEl,
            el('div', { class: 'tl-meta' }, [
              el('span', { style: { color: '#000' } }, fmtDate(p.taken_at || p.created_at)),
              isVideo ? el('span', {}, '🎬') : null,
              el('span', { html: roleIcon(p.author_role) }),
            ]),
            p.remark ? el('div', { style: { padding: '4px 10px 10px', fontSize: '12px', color: 'var(--c-text-soft)' } }, p.remark) : null,
            el('div', { style: { padding: '0 10px 10px', display:'flex', justifyContent:'flex-end', gap:'4px' } }, [
              el('button', { class: 'btn small', onclick: () => editPhotoMeta(p) }, '编辑'),
              el('button', { class: 'btn small danger', onclick: async () => {
                if (await confirmDialog('删除这张回忆？')) { await api('/api/photos/'+p.id, { method:'DELETE' }); toast('已删除'); pageTimeline(app); }
              } }, '删'),
            ]),
          ]));
        });
        
        dayGroup.appendChild(dayHeader);
        dayGroup.appendChild(dayContent);
        monthContent.appendChild(dayGroup);
        
        dayHeader.onclick = () => {
          const icon = dayHeader.querySelector('.collapse-icon');
          const isCollapsed = dayContent.style.display === 'none';
          dayContent.style.display = isCollapsed ? '' : 'none';
          icon.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(-90deg)';
        };
      });
      
      monthGroup.appendChild(monthHeader);
      monthGroup.appendChild(monthContent);
      yearContent.appendChild(monthGroup);
      
      monthHeader.onclick = () => {
        const icon = monthHeader.querySelector('.collapse-icon');
        const isCollapsed = monthContent.style.display === 'none';
        monthContent.style.display = isCollapsed ? '' : 'none';
        icon.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(-90deg)';
      };
    });
    
    yearGroup.appendChild(yearHeader);
    yearGroup.appendChild(yearContent);
    tl.appendChild(yearGroup);
    
    yearHeader.onclick = () => {
      const icon = yearHeader.querySelector('.collapse-icon');
      const isCollapsed = yearContent.style.display === 'none';
      yearContent.style.display = isCollapsed ? '' : 'none';
      icon.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(-90deg)';
    };
  });
  
  app.appendChild(tl);
}

function uploadPhotoModal(defaults = {}) {
  const form = el('form', { onsubmit: e => e.preventDefault() });
  form.innerHTML = `
    <div class="form-row"><label>选择照片或视频（可多选）</label><input type="file" name="files" accept="image/*,video/*" multiple></div>
    <div class="form-row"><label>分类</label>
      <select name="category">
        <option value="daily">恋爱日常</option>
        <option value="origin">第五人格相识回忆</option>
        <option value="travel">旅行合照</option>
        <option value="anniversary">纪念日瞬间</option>
        <option value="other">其他</option>
      </select>
    </div>
    <div class="form-row"><label>拍摄时间（可选）</label><input type="datetime-local" name="taken_at"></div>
    <div class="form-row"><label>备注</label><textarea name="remark"></textarea></div>
  `;
  if (defaults.category) form.category.value = defaults.category;
  showModal({
    title: '上传照片/视频', body: form,
    pendingText: '正在处理…',
    onOk: async () => {
      const files = Array.from(form.querySelector('input[name="files"]')?.files || []);
      if (!files.length || !files[0].size) { toast('请选择文件'); return false; }
      try { const fd = await buildUploadFormData(form); toast('正在上传，请稍候…'); await api('/api/photos', { method: 'POST', body: fd }); toast('已上传'); closeModal(); route(); }
      catch (e) { throw e; }
    }
  });
}

function editPhotoMeta(p) {
  const form = el('form', { onsubmit: e => e.preventDefault() });
  form.innerHTML = `
    <div class="form-row"><label>备注</label><textarea name="remark">${escapeHtml(p.remark || '')}</textarea></div>
    <div class="form-row"><label>分类</label>
      <select name="category">
        <option value="daily">恋爱日常</option>
        <option value="origin">第五人格相识回忆</option>
        <option value="travel">旅行合照</option>
        <option value="anniversary">纪念日瞬间</option>
        <option value="other">其他</option>
      </select>
    </div>
    <div class="form-row"><label>拍摄时间</label><input type="datetime-local" name="taken_at" value="${p.taken_at ? new Date(p.taken_at).toISOString().slice(0,16) : ''}"></div>
  `;
  form.category.value = p.category || 'daily';
  showModal({
    title: '编辑照片信息', body: form,
    onOk: async () => {
      const body = {
        remark: form.remark.value, category: form.category.value,
        taken_at: form.taken_at.value || null
      };
      await api('/api/photos/' + p.id, { method: 'PUT', body });
      toast('已保存'); closeModal(); route();
    }
  });
}

/* -------- Albums -------- */
async function pageAlbums(app, rest) {
  if (rest && rest[0]) return pageAlbumDetail(app, rest[0]);
  const { list } = await api('/api/albums');
  app.innerHTML = '';
  app.appendChild(el('div', { class: 'page-title' }, [
    el('span', {}, '🖼️ 私密相册'),
    el('small', {}, '我们的回忆按主题归类'),
  ]));
  app.appendChild(el('div', { class: 'row-end', style: { marginBottom: '12px' } }, [
    el('button', { class: 'btn primary', onclick: () => editAlbum() }, '+ 创建相册'),
  ]));
  if (!list.length) { app.appendChild(emptyBox('等待新的回忆相册入住')); return; }
  const grid = el('div', { class: 'grid cols-3' });
  list.forEach(a => {
    grid.appendChild(el('div', { class: 'card', style: { cursor: 'pointer' } }, [
      el('div', { style: { height: '120px', background: a.cover ? `url("${a.cover}") center/cover` : 'linear-gradient(135deg,#cfe5f5,#ffd4dc)', borderRadius: '10px', marginBottom: '10px' } }),
      el('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center' } }, [
        el('strong', {}, a.name),
        el('span', { class: 'tag' }, `${a.photo_count} 张`)
      ]),
      a.description ? el('div', { style: { fontSize: '12px', color: 'var(--c-text-soft)', marginTop: '4px' } }, a.description) : null,
      el('div', { class: 'row-end', style: { marginTop: '10px' } }, [
        el('button', { class: 'btn small', onclick: () => location.hash = '#/albums/' + a.id }, '查看'),
        el('button', { class: 'btn small', onclick: () => editAlbum(a) }, '编辑'),
        el('button', { class: 'btn small danger', onclick: async () => {
          if (await confirmDialog('删除该相册？里面的照片会保留但取消归属。')) { await api('/api/albums/'+a.id, { method:'DELETE' }); toast('已删除'); pageAlbums(app); }
        } }, '删除'),
      ])
    ]));
  });
  app.appendChild(grid);
}

function editAlbum(a = {}) {
  const form = el('form', { onsubmit: e => e.preventDefault() });
  form.innerHTML = `
    <div class="form-row"><label>相册名</label><input name="name" value="${escapeHtml(a.name || '')}"></div>
    <div class="form-row"><label>描述</label><textarea name="description">${escapeHtml(a.description || '')}</textarea></div>
    <div class="form-row"><label>封面图 URL（也可从相册内照片设置）</label><input name="cover" value="${escapeHtml(a.cover || '')}"></div>
  `;
  showModal({
    title: a.id ? '编辑相册' : '创建相册', body: form,
    onOk: async () => {
      const body = { name: form.name.value, description: form.description.value, cover: form.cover.value };
      if (!body.name) { toast('请填写相册名'); return; }
      await api('/api/albums' + (a.id ? '/'+a.id : ''), { method: a.id ? 'PUT' : 'POST', body });
      toast('已保存'); closeModal(); pageAlbums($('#app'));
    }
  });
}

async function pageAlbumDetail(app, id) {
  const [{ list: albums }, { list: photos }, { list: views }] = await Promise.all([
    api('/api/albums'),
    api('/api/photos?album_id=' + id),
    api('/api/albums/' + id + '/views').catch(() => ({ list: [] }))
  ]);
  await api('/api/albums/' + id + '/view', { method: 'POST' }).catch(() => {});
  const album = albums.find(a => a.id == id);
  app.innerHTML = '';
  if (!album) { app.appendChild(emptyBox('相册不见了')); return; }
  app.appendChild(el('div', { class: 'page-title' }, [
    el('a', { href: '#/albums', class: 'btn small' }, '← 返回'),
    el('span', {}, ' 🖼️ ' + album.name),
    el('small', {}, `共 ${photos.length} 个`)
  ]));
  app.appendChild(el('div', { class: 'row-end', style: { marginBottom: '12px' } }, [
    el('button', { class: 'btn', onclick: () => showAlbumViews(views) }, `查看访问 (${views.length})`),
    photos.length ? el('button', { class: 'btn', onclick: () => downloadAlbumZip(album, photos) }, `📥 打包下载 (${photos.length})`) : null,
    el('button', { class: 'btn primary', onclick: () => uploadToAlbumModal(id) }, '+ 上传到此相册'),
  ]));
  if (!photos.length) { app.appendChild(emptyBox('空相册，等待新的回忆照片或视频入住')); return; }
  const grid = el('div', { class: 'tl-items' });
  const imagePaths = photos.filter(p => p.media_type === 'image').map(x => x.path);
  photos.forEach((p, pi) => {
    const isVideo = p.media_type === 'video';
    const mediaEl = isVideo 
      ? el('video', { src: p.path, controls: true, style: { width: '100%', height: '200px', objectFit: 'cover', borderRadius: '10px' } })
      : el('img', imageAttrs({ src: p.path, onclick: () => lightbox(p.path, imagePaths, imagePaths.indexOf(p)) }));
    
    grid.appendChild(el('div', { class: 'tl-card' }, [
      mediaEl,
      el('div', { class: 'tl-meta' }, [
        el('span', {}, fmtDate(p.taken_at || p.created_at)),
        isVideo ? el('span', {}, '🎬') : null,
        el('span', { html: roleIcon(p.author_role) }),
      ]),
      el('div', { style: { padding: '0 10px 10px', display:'flex', justifyContent:'flex-end', gap:'4px' } }, [
        !isVideo ? el('button', { class: 'btn small', onclick: async () => {
          await api('/api/albums/' + id, { method:'PUT', body: { cover: p.path } });
          toast('已设为封面');
        } }, '设封面') : null,
        el('button', { class: 'btn small danger', onclick: async () => {
          if (await confirmDialog('从相册移除该媒体（不删除原文件）？'))
          { await api('/api/photos/'+p.id, { method:'PUT', body: { album_id: null } }); toast('已移出'); route(); }
        } }, '移出'),
      ])
    ]));
  });
  app.appendChild(grid);
}

async function downloadAlbumZip(album, photos) {
  if (typeof JSZip === 'undefined') { toast('打包脚本未加载，请刷新页面重试'); return; }
  if (!photos || !photos.length) { toast('相册是空的~'); return; }
  const total = photos.length;
  const tip = el('div', { class: 'card', style: { position:'fixed', right:'20px', bottom:'20px', zIndex:1000, minWidth:'240px', boxShadow:'0 8px 24px rgba(180,140,160,.25)' } }, [
    el('div', { style: { fontWeight: 600, marginBottom: '6px' } }, `📥 正在打包 ${escapeHtml(album.name || '相册')}`),
    el('div', { id: 'zip-progress', style: { fontSize: '12px', color: 'var(--c-text-soft)' } }, `准备中… 0 / ${total}`),
    el('div', { class: 'progress-bar', style: { marginTop:'6px' } }, [ el('div', { id: 'zip-progress-fill', style: { width: '0%' } }) ])
  ]);
  document.body.appendChild(tip);
  const updateTip = (done, msg) => {
    const p = document.getElementById('zip-progress');
    const f = document.getElementById('zip-progress-fill');
    if (p) p.textContent = msg || `${done} / ${total}`;
    if (f) f.style.width = (done / total * 100) + '%';
  };
  const zip = new JSZip();
  const folder = zip.folder((album.name || 'album').replace(/[\\/:*?"<>|]/g, '_'));
  let done = 0; let failed = 0;
  for (const p of photos) {
    try {
      const r = await fetch(p.path, { credentials: 'same-origin' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const blob = await r.blob();
      const ext = (p.path.match(/\.([a-zA-Z0-9]{2,5})(?:\?.*)?$/)?.[1] || 'jpg').toLowerCase();
      const dateStr = (p.taken_at || p.created_at || '').slice(0, 10);
      const baseRaw = (p.remark || '').replace(/[\\/:*?"<>|\r\n]/g, ' ').trim().slice(0, 60);
      const base = baseRaw || `photo-${p.id}`;
      const name = `${dateStr ? dateStr + '_' : ''}${base}_${p.id}.${ext}`;
      folder.file(name, blob);
    } catch (e) {
      failed++;
    }
    done++;
    updateTip(done);
  }
  updateTip(done, `打包压缩中…(可能稍久)`);
  try {
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, m => {
      updateTip(done, `压缩中 ${m.percent.toFixed(0)}%`);
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(album.name || 'album').replace(/[\\/:*?"<>|]/g, '_')}_${new Date().toISOString().slice(0,10)}.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(failed ? `打包完成，${failed} 张获取失败` : '打包完成 🎁');
  } catch (e) {
    toast('打包失败：' + e.message);
  } finally {
    setTimeout(() => tip.remove(), 1200);
  }
}

function showAlbumViews(views) {
  const body = el('div');
  if (!views.length) body.appendChild(el('p', { class: 'empty' }, '还没有访问记录'));
  views.forEach(v => body.appendChild(el('div', { style: { padding: '6px 0', fontSize: '13px', borderBottom: '1px dashed var(--c-line)' }, html: `${roleIcon(v.role)} ${escapeHtml(v.nickname)} · ${fmtDateTime(v.viewed_at)}` })));
  showModal({ title: '相册访问记录', body, okText: '知道啦', onOk: closeModal });
}

function uploadToAlbumModal(albumId) {
  const form = el('form', { onsubmit: e => e.preventDefault() });
  form.innerHTML = `
    <div class="form-row"><label>选择照片或视频（可多选）</label><input type="file" name="files" accept="image/*,video/*" multiple></div>
    <div class="form-row"><label>分类</label>
      <select name="category">
        <option value="daily">恋爱日常</option><option value="origin">第五人格相识回忆</option>
        <option value="travel">旅行合照</option><option value="anniversary">纪念日瞬间</option><option value="other">其他</option>
      </select>
    </div>
    <div class="form-row"><label>备注</label><textarea name="remark"></textarea></div>
  `;
  showModal({
    title: '上传到相册', body: form,
    pendingText: '正在处理…',
    onOk: async () => {
      const files = Array.from(form.querySelector('input[name="files"]')?.files || []);
      if (!files.length || !files[0].size) { toast('请选择文件'); return false; }
      const fd = await buildUploadFormData(form, { album_id: albumId });
      toast('正在上传，请稍候…');
      await api('/api/photos', { method: 'POST', body: fd });
      toast('已上传'); closeModal(); route();
    }
  });
}

/* -------- Diaries -------- */
async function pageDiaries(app, rest) {
  if (rest && rest[0]) return pageDiaryDetail(app, rest[0]);
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const q = params.get('q') || '';
  const { list } = await api('/api/diaries' + (q ? '?q=' + encodeURIComponent(q) : ''));
  app.innerHTML = '';
  app.appendChild(el('div', { class: 'page-title' }, [
    el('span', {}, '📔 恋爱日记'),
    el('small', {}, '把心事写给彼此')
  ]));
  const search = el('input', { placeholder: '搜索日记内容…', value: q, style: { maxWidth: '280px' } });
  search.addEventListener('keydown', e => { if (e.key === 'Enter') location.hash = '#/diaries?q=' + encodeURIComponent(e.target.value); });
  app.appendChild(el('div', { class: 'row', style: { marginBottom: '12px', justifyContent: 'space-between' } }, [
    search,
    el('button', { class: 'btn primary', onclick: () => editDiary() }, '+ 写日记')
  ]));
  if (!list.length) { app.appendChild(emptyBox('庄园的笔记本还空着，写下第一篇吧')); return; }
  list.forEach(d => {
    const text = (d.content || '').replace(/<[^>]+>/g, '').slice(0, 160);
    app.appendChild(el('div', { class: 'card diary-card', onclick: () => location.hash = '#/diaries/' + d.id, style: { cursor: 'pointer' } }, [
      el('div', { class: 'meta' }, [
        el('span', { html: roleEmblem(d.author_role) }),
        el('span', {}, fmtDateTime(d.diary_date || d.created_at)),
        d.weather ? el('span', {}, `· ${d.weather}`) : null,
        el('span', {}, `· ♥ ${d.likes || 0}`),
      ]),
      el('div', { class: 'content' }, text + (d.content.length > 160 ? '…' : '')),
    ]));
  });
}

async function pageDiaryDetail(app, id) {
  const { diary, comments } = await api('/api/diaries/' + id);
  app.innerHTML = '';
  app.appendChild(el('div', { class: 'page-title' }, [
    el('a', { href: '#/diaries', class: 'btn small' }, '← 返回'),
    el('span', {}, ' 📔 日记详情'),
  ]));
  app.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'diary-card meta', style: { marginBottom: '10px' } }, [
      el('span', { html: roleEmblem(diary.author_role) }),
      el('span', {}, fmtDateTime(diary.diary_date || diary.created_at)),
      diary.weather ? el('span', {}, `· ${diary.weather}`) : null,
    ]),
    el('div', { class: 'content', style: { lineHeight: 1.8, whiteSpace: 'pre-wrap' }, html: diary.content }),
    el('div', { class: 'row-end', style: { marginTop: '14px' } }, [
      el('button', { class: 'btn', onclick: async () => { await api('/api/diaries/'+id+'/like', { method: 'POST' }); toast('点亮了一颗心 ♥'); route(); } }, `♥ ${diary.likes || 0}`),
      el('button', { class: 'btn', onclick: () => editDiary(diary) }, '编辑'),
      el('button', { class: 'btn danger', onclick: async () => {
        if (await confirmDialog('删除这篇日记？')) { await api('/api/diaries/'+id, { method:'DELETE' }); toast('已删除'); location.hash='#/diaries'; }
      } }, '删除'),
    ])
  ]));
  // comments
  const commCard = el('div', { class: 'card' }, [ el('h3', { style: { margin: '0 0 10px' } }, '彼此的回应') ]);
  if (!comments.length) commCard.appendChild(el('p', { class: 'empty', style: { padding: '20px' } }, '还没有回应，写一句心里话吧'));
  comments.forEach(c => {
    commCard.appendChild(el('div', { style: { padding: '8px 0', borderBottom: '1px dashed var(--c-line)' } }, [
      el('div', { style: { fontSize: '12px', color: 'var(--c-text-soft)' }, html: roleEmblem(c.role) + ' · ' + fmtDateTime(c.created_at) }),
      el('div', { style: { marginTop: '4px', lineHeight: 1.6 } }, c.content),
    ]));
  });
  const ta = el('textarea', { placeholder: '说点什么…' });
  const sendBtn = el('button', { class: 'btn primary', onclick: async () => {
    if (!ta.value.trim()) return;
    await api('/api/diaries/'+id+'/comment', { method:'POST', body: { content: ta.value } });
    toast('已回应'); route();
  } }, '回应');
  commCard.appendChild(el('div', { style: { marginTop: '10px', display:'flex', gap:'8px' } }, [ ta, sendBtn ]));
  app.appendChild(commCard);
}

function editDiary(d = {}) {
  const form = el('form', { onsubmit: e => e.preventDefault() });
  form.innerHTML = `
    <div class="form-row"><label>日记时间（用于补录以前写的日记）</label><input type="datetime-local" name="diary_date" value="${toLocalDateTimeValue(d.diary_date || d.created_at || new Date())}"></div>
    <div class="form-row"><label>天气 / 心情</label><input name="weather" placeholder="如 晴 / 想你 / 一起开黑" value="${escapeHtml(d.weather || '')}"></div>
    <div class="form-row"><label>日记内容（支持换行）</label><textarea name="content" rows="10" placeholder="今天和你…">${escapeHtml(d.content || '')}</textarea></div>
  `;
  showModal({
    title: d.id ? '编辑日记' : '写日记', body: form,
    onOk: async () => {
      const body = { content: form.content.value, weather: form.weather.value, diary_date: form.diary_date.value || null };
      if (!body.content.trim()) { toast('日记内容不能为空'); return; }
      await api('/api/diaries' + (d.id ? '/'+d.id : ''), { method: d.id ? 'PUT' : 'POST', body });
      toast('已保存'); closeModal(); route();
    }
  });
}

/* -------- Messages -------- */
async function pageMessages(app) {
  const { list } = await api('/api/messages');
  app.innerHTML = '';
  app.appendChild(el('div', { class: 'page-title' }, [
    el('span', {}, '💌 悄悄话留言板'),
    el('small', {}, '只属于二人的耳语')
  ]));
  const chat = el('div', { class: 'chat card' });
  if (!list.length) chat.appendChild(emptyBox('说点什么吧，对方上线就能看到'));
  list.forEach(m => {
    const mine = m.sender_id === App.user.id;
    chat.appendChild(el('div', { class: 'bubble ' + (mine ? 'mine' : 'theirs') }, [
      el('div', { style: { whiteSpace: 'pre-wrap' } }, m.content),
      el('div', { class: 'b-meta', html: `${roleIcon(m.sender_role)} ${fmtDateTime(m.created_at)} ${mine ? (m.is_read ? '· 已读' : '· 未读') : ''}` }),
      mine ? el('button', { class: 'btn small danger', style: { marginTop: '6px' }, onclick: async () => {
        if (await confirmDialog('收回这句悄悄话？')) { await api('/api/messages/'+m.id, { method:'DELETE' }); route(); }
      } }, '删除') : null,
    ]));
  });
  app.appendChild(chat);

  const ta = el('textarea', { placeholder: '写下悄悄话…（Ctrl/⌘ + Enter 发送）' });
  ta.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') send();
  });
  const send = async () => {
    if (!ta.value.trim()) return;
    await api('/api/messages', { method:'POST', body: { content: ta.value } });
    ta.value = ''; route();
  };
  app.appendChild(el('div', { class: 'chat-input' }, [
    ta, el('button', { class: 'btn primary', onclick: send }, '发送 💌')
  ]));
  // scroll chat to bottom
  setTimeout(() => chat.scrollTop = chat.scrollHeight, 50);
}

/* -------- Todos -------- */
async function pageTodos(app) {
  const { list, stat } = await api('/api/todos');
  app.innerHTML = '';
  app.appendChild(el('div', { class: 'page-title' }, [
    el('span', {}, '✅ 未做之事'),
    el('small', {}, '一起把心愿一件件完成')
  ]));
  const total = Number(stat.total) || 0;
  const done = Number(stat.done) || 0;
  const pct = total ? Math.round(done / total * 100) : 0;
  app.appendChild(el('div', { class: 'card' }, [
    el('div', { style: { display:'flex', justifyContent:'space-between', marginBottom:'8px' } }, [
      el('span', {}, `已完成 ${done} / ${total}`),
      el('strong', {}, pct + '%'),
    ]),
    el('div', { class: 'progress-bar' }, [ el('div', { style: { width: pct + '%' } }) ])
  ]));
  app.appendChild(el('div', { class: 'row-end', style: { marginBottom: '12px' } }, [
    el('button', { class: 'btn primary', onclick: () => editTodo() }, '+ 新增心愿')
  ]));
  if (!list.length) { app.appendChild(emptyBox('心愿清单空空，添加第一件想一起做的事')); return; }
  list.forEach(t => {
    const due = t.due_date ? new Date(t.due_date) : null;
    const today = new Date(); today.setHours(0,0,0,0);
    const near = due && (due - today) / 86400000 <= 7 && t.status !== 'done';
    const isCreator = t.creator_id === App.user.id;
    app.appendChild(el('div', { class: 'todo-item ' + t.status, style: near ? { background: '#fff5d6' } : {} }, [
      el('div', { style: { flexShrink: 0, fontSize: '22px' } }, t.status === 'done' ? '✅' : t.status === 'doing' ? '🌱' : '⭐'),
      el('div', { class: 'body' }, [
        el('div', { class: 'title' }, [
          t.pinned ? el('span', {}, '📌 ') : null,
          document.createTextNode(t.title),
          el('span', { class: 'tag ' + t.status, style: { marginLeft: '8px' } }, t.status === 'done' ? '已完成' : t.status === 'doing' ? '进行中' : '未开始'),
          el('span', { class: 'tag', style: { marginLeft: '4px' } }, t.category),
          isCreator ? el('span', { class: 'tag', style: { marginLeft: '4px' } }, '我发起的') : null,
        ]),
        t.remark ? el('div', { class: 'meta', style: { whiteSpace:'pre-wrap' } }, t.remark) : null,
        el('div', { class: 'meta', html: [
          `创建：${roleIcon(t.creator_role)} ${escapeHtml(t.creator_nickname || '')}`,
          t.due_date ? ` · 预计 ${fmtDate(t.due_date)}` : '',
          t.done_at ? ` · 完成 ${fmtDate(t.done_at)}（${roleIcon(t.confirmer_role)} 确认）` : '',
        ].join('') }),
        t.photo ? el('img', { src: t.photo, style: { width:'120px', borderRadius:'8px', marginTop:'6px', cursor:'zoom-in' }, onclick: () => lightbox(t.photo) }) : null,
        t.reflection ? el('div', { style: { marginTop: '6px', fontSize: '12px', color:'var(--c-text-soft)' } }, '心得：' + t.reflection) : null,
        t.reject_reason ? el('div', { class: 'reject-note' },
          `🙅 对方曾拒绝完成（${fmtDateTime(t.rejected_at)}）：${t.reject_reason}`) : null,
      ]),
      el('div', { class: 'row-end', style: { flexShrink: 0, flexDirection: 'column' } }, [
        t.status !== 'done' ? el('button', { class: 'btn small primary', onclick: () => completeTodo(t) }, '✓ 完成') : null,
        t.status === 'pending' ? el('button', { class: 'btn small', onclick: async () => { await api('/api/todos/'+t.id, { method:'PUT', body:{ status:'doing' } }); route(); } }, '开始') : null,
        // 非发起人 + 已完成：可拒绝（让对方知道理由）
        (!isCreator && t.status === 'done') ? el('button', { class: 'btn small danger', onclick: () => rejectTodo(t) }, '🙅 拒绝完成') : null,
        el('button', { class: 'btn small', onclick: () => togglePin('todos', t) }, t.pinned ? '取置顶' : '置顶'),
        el('button', { class: 'btn small', onclick: () => editTodo(t) }, '编辑'),
        // 仅发起人可删除
        isCreator ? el('button', { class: 'btn small danger', onclick: async () => {
          if (await confirmDialog('删除该心愿？删除后无法恢复哦~')) {
            try { await api('/api/todos/'+t.id, { method:'DELETE' }); toast('已删除'); route(); }
            catch (e) { toast(e.message); }
          }
        } }, '删除') : null,
      ])
    ]));
  });
}

function rejectTodo(t) {
  const ta = el('textarea', { rows: 4, placeholder: '比如：我们其实还没真正一起做过呀…' });
  showModal({
    title: '🙅 拒绝完成（仅留给对方）',
    body: el('div', {}, [
      el('p', { style: { color: 'var(--c-text-soft)', fontSize: '13px', lineHeight: 1.6 } },
        `心愿「${t.title}」会被打回到 进行中 状态，对方会看到你的拒绝理由。`),
      el('div', { class: 'form-row' }, [ el('label', {}, '拒绝理由（必填）'), ta ])
    ]),
    okText: '确认拒绝',
    onOk: async () => {
      if (!ta.value.trim()) { toast('请写下拒绝理由'); return; }
      try {
        await api('/api/todos/'+t.id+'/reject', { method:'POST', body: { reason: ta.value } });
        toast('已告诉对方你的想法'); closeModal(); route();
      } catch (e) { toast(e.message); }
    }
  });
}

function editTodo(t = {}) {
  const form = el('form', { onsubmit: e => e.preventDefault() });
  form.innerHTML = `
    <div class="form-row"><label>标题</label><input name="title" value="${escapeHtml(t.title || '')}"></div>
    <div class="form-row"><label>分类</label>
      <select name="category">
        <option value="daily">日常小事</option>
        <option value="ceremony">仪式感事项</option>
        <option value="manor">庄园专属（第五人格）</option>
        <option value="other">其他</option>
      </select>
    </div>
    <div class="form-row"><label>备注</label><textarea name="remark">${escapeHtml(t.remark || '')}</textarea></div>
    <div class="form-row"><label>计划完成日期</label><input name="due_date" type="date" placeholder="选择日期" value="${t.due_date ? fmtDate(t.due_date) : ''}"></div>
  `;
  if (t.category) form.category.value = t.category;
  showModal({
    title: t.id ? '编辑心愿' : '新增心愿', body: form,
    onOk: async () => {
      const body = {
        title: form.title.value.trim(),
        category: form.category.value,
        remark: form.remark.value,
        due_date: form.due_date.value || null,
      };
      if (!body.title) { toast('请填写标题'); return; }
      await api('/api/todos' + (t.id ? '/'+t.id : ''), { method: t.id ? 'PUT' : 'POST', body });
      toast('已保存'); closeModal(); route();
    }
  });
}

function completeTodo(t) {
  const form = el('form', { onsubmit: e => e.preventDefault() });
  form.innerHTML = `
    <p>恭喜解锁徽章 🏅 完成「${escapeHtml(t.title)}」</p>
    <div class="form-row"><label>打卡照片（可选）</label><input type="file" name="photo" accept="image/*"></div>
    <div class="form-row"><label>心得感想</label><textarea name="reflection" placeholder="一起完成的感觉…"></textarea></div>
  `;
  showModal({
    title: '完成心愿', body: form, okText: '解锁徽章', pendingText: '正在压缩…',
    onOk: async () => {
      const fd = await buildUploadFormData(form);
      fd.append('status', 'done');
      if (!fd.get('photo')?.size) fd.delete('photo');
      await api('/api/todos/'+t.id, { method: 'PUT', body: fd });
      toast('✨ 徽章解锁'); closeModal(); route();
    }
  });
}

/* -------- Travels -------- */
async function pageTravels(app) {
  const { list } = await api('/api/travels');
  app.innerHTML = '';
  app.appendChild(el('div', { class: 'page-title' }, [
    el('span', {}, '🗺️ 期待旅行目的地'),
    el('small', {}, '想一起去看的风景')
  ]));
  app.appendChild(el('div', { class: 'row-end', style: { marginBottom: '12px' } }, [
    el('button', { class: 'btn', onclick: () => manageTags() }, '🏷️ 管理标签'),
    el('button', { class: 'btn primary', onclick: () => editTravel() }, '+ 新增地点')
  ]));
  if (!list.length) { app.appendChild(emptyBox('世界那么大，添加第一个想去的地方吧')); return; }
  const want = list.filter(t => t.status === 'want');
  const done = list.filter(t => t.status === 'done');
  if (want.length) {
    app.appendChild(el('h3', { style: { color: 'var(--c-text-soft)', margin: '4px 0 8px' } }, '心愿清单'));
    app.appendChild(travelGrid(want));
  }
  if (done.length) {
    app.appendChild(el('h3', { style: { color: 'var(--c-text-soft)', margin: '16px 0 8px' } }, '我们走过的地方'));
    app.appendChild(travelGrid(done));
  }
}

function travelGrid(items) {
  const grid = el('div', { class: 'grid cols-3' });
  items.forEach(t => {
    grid.appendChild(el('div', { class: 'travel-card' }, [
      el('div', { class: 'cover', style: { backgroundImage: t.cover ? `url("${t.cover}")` : '' } }),
      el('div', { class: 'body' }, [
        el('div', { class: 'name' }, [
          t.pinned ? el('span', {}, '📌 ') : null,
          document.createTextNode(t.name),
          el('span', { class: 'tag ' + (t.status === 'done' ? 'done' : 'want'), style: { marginLeft: '6px' } }, t.status === 'done' ? '已打卡' : '期待中'),
          el('span', { class: 'tag', style: { marginLeft: '4px' } }, t.tag),
          t.media_count > 0 ? el('span', { class: 'tag', style: { marginLeft: '4px', background: 'var(--c-blue)' } }, `📷${t.media_count}`) : null,
        ]),
        t.plan_date ? el('div', { style: { fontSize: '12px', color: 'var(--c-text-soft)' } }, '计划：' + fmtDate(t.plan_date)) : null,
        t.reason ? el('div', { class: 'reason' }, t.reason) : null,
      ]),
      el('div', { class: 'actions' }, [
        t.status === 'want' ? el('button', { class: 'btn small primary', onclick: async () => { await api('/api/travels/'+t.id, { method:'PUT', body:{ status:'done' } }); toast('🎉 已打卡'); route(); } }, '✓ 打卡') : null,
        t.status === 'done' ? el('button', { class: 'btn small', onclick: () => viewTravelMedia(t) }, '📷 相册') : null,
        el('button', { class: 'btn small', onclick: () => togglePin('travels', t) }, t.pinned ? '取置顶' : '置顶'),
        el('button', { class: 'btn small', onclick: () => editTravel(t) }, '编辑'),
        el('button', { class: 'btn small danger', onclick: async () => {
          if (await confirmDialog('删除这个目的地？')) { await api('/api/travels/'+t.id, { method:'DELETE' }); toast('已删除'); route(); }
        } }, '删除'),
      ])
    ]));
  });
  return grid;
}

async function editTravel(t = {}) {
  const { list: tags } = await api('/api/tags').catch(() => ({ list: [] }));
  const { list: photos } = await api('/api/photos').catch(() => ({ list: [] }));
  let selectedCover = t.cover || '';
  const form = el('form', { onsubmit: e => e.preventDefault() });
  
  const tagSelect = el('select', { name: 'tag' });
  const defaultTags = [
    { value: 'short', label: '短途' },
    { value: 'sea', label: '海边' },
    { value: 'food', label: '美食' },
    { value: 'mountain', label: '爬山' },
    { value: 'manor', label: '第五人格主题展' },
    { value: 'other', label: '其他' }
  ];
  [...defaultTags, ...tags].forEach(tag => {
    const opt = el('option', { value: tag.value || tag.name }, tag.label || tag.name);
    if ((t.tag === tag.value) || (t.tag === tag.name)) opt.selected = true;
    tagSelect.appendChild(opt);
  });
  
  form.innerHTML = `
    <div class="form-row"><label>地点名称</label><input name="name" value="${escapeHtml(t.name || '')}"></div>
    <div class="form-row"><label>标签</label></div>
    <div class="form-row"><label>想去理由</label><textarea name="reason">${escapeHtml(t.reason || '')}</textarea></div>
    <div class="form-row"><label>计划出行日期</label><input type="date" name="plan_date" value="${t.plan_date ? fmtDate(t.plan_date) : ''}"></div>
    <div class="form-row"><label>上传新封面（手机端可调用相册/拍照）</label><input type="file" name="cover" accept="image/*"></div>
    <input type="hidden" name="cover_selected" value="${escapeHtml(selectedCover)}">
  `;
  form.insertBefore(tagSelect, form.children[2]);

  const imagePhotos = photos.filter(p => p.media_type !== 'video');
  const coverPreview = el('div', { style: { marginTop: '8px' } });
  const renderCoverPreview = () => {
    coverPreview.innerHTML = '';
    coverPreview.appendChild(selectedCover
      ? el('img', { src: selectedCover, style: { width: '160px', height: '100px', objectFit: 'cover', borderRadius: '10px', border: '2px solid var(--c-pink)' } })
      : el('div', { style: { color: 'var(--c-text-soft)', fontSize: '12px' } }, '暂未选择封面')
    );
  };
  renderCoverPreview();

  const albumCoverBox = el('div', { class: 'form-row' }, [
    el('label', {}, '或从已上传图片中选择'),
    coverPreview
  ]);
  if (imagePhotos.length) {
    const picker = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', maxHeight: '220px', overflowY: 'auto', marginTop: '8px' } });
    imagePhotos.slice(0, 80).forEach(p => {
      picker.appendChild(el('img', {
        src: p.path,
        style: {
          width: '100%',
          height: '70px',
          objectFit: 'cover',
          borderRadius: '8px',
          cursor: 'pointer',
          border: selectedCover === p.path ? '3px solid var(--c-pink)' : '1px solid var(--c-line)'
        },
        onclick: e => {
          selectedCover = p.path;
          form.cover_selected.value = selectedCover;
          picker.querySelectorAll('img').forEach(img => img.style.border = '1px solid var(--c-line)');
          e.currentTarget.style.border = '3px solid var(--c-pink)';
          renderCoverPreview();
        }
      }));
    });
    albumCoverBox.appendChild(picker);
  } else {
    albumCoverBox.appendChild(el('div', { style: { color: 'var(--c-text-soft)', fontSize: '12px', marginTop: '6px' } }, '还没有可选图片，可以先上传新封面'));
  }
  form.appendChild(albumCoverBox);
  
  showModal({
    title: t.id ? '编辑目的地' : '新增目的地', body: form,
    pendingText: '正在压缩…',
    onOk: async () => {
      const fd = await buildUploadFormData(form);
      if (!fd.get('cover')?.size) fd.delete('cover');
      if (!fd.get('name')) { toast('请填写名称'); return; }
      await api('/api/travels' + (t.id ? '/'+t.id : ''), { method: t.id ? 'PUT' : 'POST', body: fd });
      toast('已保存'); closeModal(); route();
    }
  });
}

async function viewTravelMedia(t) {
  const { list: media } = await api('/api/travels/' + t.id + '/media');
  const body = el('div');
  
  body.appendChild(el('h3', { style: { margin: '0 0 12px' } }, `${t.name} 的相册`));
  
  if (!media.length) {
    body.appendChild(emptyBox('还没有添加照片或视频'));
  } else {
    const grid = el('div', { class: 'tl-items' });
    media.forEach(m => {
      const isVideo = m.media_type === 'video';
      const mediaEl = isVideo 
        ? el('video', { src: m.path, controls: true, style: { width: '100%', height: '200px', objectFit: 'cover', borderRadius: '10px' } })
        : el('img', { src: m.path, style: { width: '100%', height: '200px', objectFit: 'cover', borderRadius: '10px', cursor: 'zoom-in' }, onclick: () => lightbox(m.path, media.filter(x => x.media_type === 'image').map(x => x.path)) });
      
      grid.appendChild(el('div', { class: 'tl-card' }, [
        mediaEl,
        el('div', { class: 'tl-meta' }, [
          el('span', {}, isVideo ? ' 视频' : ' 图片'),
          el('span', {}, fmtDate(m.created_at)),
        ]),
        m.remark ? el('div', { style: { padding: '4px 10px 10px', fontSize: '12px', color: 'var(--c-text-soft)' } }, m.remark) : null,
        el('div', { style: { padding: '0 10px 10px', display:'flex', justifyContent:'flex-end', gap:'4px' } }, [
          el('button', { class: 'btn small danger', onclick: async () => {
            if (await confirmDialog('删除这个媒体？')) { await api('/api/travels/'+t.id+'/media/'+m.id, { method:'DELETE' }); toast('已删除'); viewTravelMedia(t); }
          } }, '删除'),
        ])
      ]));
    });
    body.appendChild(grid);
  }
  
  body.appendChild(el('div', { class: 'row-end', style: { marginTop: '16px' } }, [
    el('button', { class: 'btn primary', onclick: () => addTravelMedia(t) }, '+ 添加照片/视频'),
  ]));
  
  showModal({ title: t.name + ' 相册', body, okText: '关闭', onOk: closeModal });
}

async function addTravelMedia(t) {
  const form = el('form', { onsubmit: e => e.preventDefault() });
  form.innerHTML = `
    <div class="form-row"><label>选择照片或视频（可多选）</label><input type="file" name="files" accept="image/*,video/*" multiple></div>
    <div class="form-row"><label>备注（可选）</label><textarea name="remark"></textarea></div>
  `;
  showModal({
    title: '添加媒体', body: form,
    pendingText: '正在压缩…',
    onOk: async () => {
      const fd = await buildUploadFormData(form);
      if (!fd.getAll('files').length || !fd.getAll('files')[0].size) { toast('请选择文件'); return false; }
      toast('正在上传，请稍候…');
      await api('/api/travels/' + t.id + '/media', { method: 'POST', body: fd });
      toast('已添加'); closeModal(); viewTravelMedia(t);
    }
  });
}

async function manageTags() {
  const { list: tags } = await api('/api/tags');
  const body = el('div');
  
  const tagList = el('div', { style: { marginBottom: '16px' } });
  if (!tags.length) {
    tagList.appendChild(el('p', { class: 'empty', style: { padding: '20px' } }, '还没有自定义标签'));
  } else {
    tags.forEach(tag => {
      tagList.appendChild(el('div', { style: { 
        padding: '10px 16px', 
        background: 'var(--c-cream-2)', 
        borderRadius: '8px', 
        marginBottom: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}, [
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
          el('span', { style: { 
            display: 'inline-block', 
            width: '16px', 
            height: '16px', 
            borderRadius: '50%', 
            background: tag.color 
          }}),
          el('strong', {}, tag.name)
        ]),
        el('button', { class: 'btn small danger', onclick: async () => {
          if (await confirmDialog('删除这个标签？')) { await api('/api/tags/'+tag.id, { method:'DELETE' }); toast('已删除'); manageTags(); }
        } }, '删除')
      ]));
    });
  }
  body.appendChild(tagList);
  
  const form = el('form', { onsubmit: e => e.preventDefault() });
  form.innerHTML = `
    <div class="form-row"><label>标签名称</label><input name="name" placeholder="例如：温泉、游乐园"></div>
    <div class="form-row"><label>标签颜色</label><input type="color" name="color" value="#FF6B6B"></div>
  `;
  body.appendChild(form);
  
  showModal({
    title: '管理自定义标签',
    body,
    okText: '添加标签',
    onOk: async () => {
      const name = form.name.value.trim();
      const color = form.color.value;
      if (!name) { toast('请填写标签名称'); return; }
      try {
        await api('/api/tags', { method: 'POST', body: { name, color } });
        toast('已添加'); form.name.value = ''; manageTags();
      } catch (e) { toast(e.message); }
    }
  });
}

/* -------- Capsules -------- */
async function pageCapsules(app) {
  const { list } = await api('/api/capsules');
  app.innerHTML = '';
  app.appendChild(el('div', { class: 'page-title' }, [
    el('span', {}, '⏳ 时光胶囊'),
    el('small', {}, '把现在的话寄给未来的我们')
  ]));
  app.appendChild(el('div', { class: 'row-end', style: { marginBottom: '12px' } }, [
    el('button', { class: 'btn primary', onclick: () => editCapsule() }, '+ 写一封时光信')
  ]));
  if (!list.length) { app.appendChild(emptyBox('还没有胶囊，写一封等待未来打开吧')); return; }
  list.forEach(c => {
    const unlocked = !!Number(c.unlocked);
    const mine = c.sender_id === App.user.id;
    const visible = unlocked || mine;
    app.appendChild(el('div', { class: 'capsule-card ' + (unlocked ? 'unlocked' : 'locked') }, [
      el('div', { class: 'cap-meta', html:
        `${mine ? '✉️ 你寄出 → ' + roleIcon(c.sender_role === 'boy' ? 'girl' : 'boy') : '📬 来自 ' + roleIcon(c.sender_role)} · 解锁时间 ${fmtDateTime(c.unlock_at)} · ${unlocked ? '已解锁' : '待解锁'}` }),
      visible ? el('div', { class: 'cap-content' }, c.content) :
                el('div', { class: 'cap-content', style: { color:'var(--c-text-soft)', fontStyle:'italic' } }, '🔒 时间还没到，悄悄保存中…'),
      visible && c.image ? el('img', { src: c.image, style: { width: '100%', maxHeight:'240px', objectFit:'cover', borderRadius:'10px', marginTop:'8px', cursor:'zoom-in' }, onclick: () => lightbox(c.image) }) : null,
      mine ? el('div', { class: 'row-end', style: { marginTop: '10px' } }, [
        el('button', { class: 'btn small danger', onclick: async () => {
          if (await confirmDialog('销毁这枚胶囊？')) { await api('/api/capsules/'+c.id, { method:'DELETE' }); toast('已销毁'); route(); }
        } }, '销毁')
      ]) : null,
    ]));
  });
}

function editCapsule() {
  const form = el('form', { onsubmit: e => e.preventDefault() });
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  form.innerHTML = `
    <div class="form-row"><label>给未来 TA 的话</label><textarea name="content" rows="8" placeholder="亲爱的…"></textarea></div>
    <div class="form-row"><label>附图（可选）</label><input type="file" name="image" accept="image/*"></div>
    <div class="form-row"><label>解锁时间</label><input type="datetime-local" name="unlock_at" value="${tomorrow}"></div>
  `;
  showModal({
    title: '写一封时光信', body: form, okText: '封存',
    pendingText: '正在压缩…',
    onOk: async () => {
      const fd = await buildUploadFormData(form);
      if (!fd.get('image')?.size) fd.delete('image');
      if (!fd.get('content')) { toast('请写下想说的话'); return; }
      await api('/api/capsules', { method:'POST', body: fd });
      toast('🌌 已封存，时间会替你保管'); closeModal(); route();
    }
  });
}

async function checkPendingCapsules() {
  try {
    const { list } = await api('/api/capsules/pending');
    if (list.length) {
      const c = list[0];
      showModal({
        title: '⏳ 时光胶囊解锁了',
        body: el('div', {}, [
          el('p', { style: { color: 'var(--c-text-soft)' }, html: `来自 ${roleIcon(c.sender_role)} 的留言，封存于 ${fmtDateTime(c.created_at)}` }),
          el('div', { style: { whiteSpace: 'pre-wrap', lineHeight: 1.7, padding: '12px', background: 'var(--c-cream-2)', borderRadius: '10px', marginTop: '10px' } }, c.content),
          c.image ? el('img', { src: c.image, style: { width:'100%', borderRadius:'10px', marginTop:'10px' } }) : null,
        ]),
        okText: '永久珍藏',
        onOk: async () => { await api('/api/capsules/'+c.id+'/read', { method:'POST' }); closeModal(); }
      });
    }
  } catch (e) {}
}

/* -------- Origin -------- */
async function pageOrigin(app) {
  const { origin, photos } = await api('/api/origin');
  app.innerHTML = '';
  app.appendChild(el('div', { class: 'origin-hero' }, [
    el('h2', {}, '🎭 庄园缘起'),
    el('p', {}, '我们的故事，始于第五人格的某一场对局'),
  ]));
  app.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'row', style: { justifyContent: 'space-between' } }, [
      el('h3', { style: { margin: 0 } }, '初识档案'),
      el('button', { class: 'btn small', onclick: () => editOrigin(origin) }, '编辑'),
    ]),
    el('div', { class: 'grid cols-2', style: { marginTop: '10px' } }, [
      originField('相识日期', origin.meet_date ? fmtDate(origin.meet_date) : '未填写'),
      originField('第一次对局', origin.first_match || '未填写'),
      originField('🦈 本命角色', origin.boy_character || '未填写'),
      originField('🐝 本命角色', origin.girl_character || '未填写'),
    ]),
    el('div', { style: { marginTop: '14px' } }, [
      el('div', { style: { fontSize: '12px', color: 'var(--c-text-soft)', marginBottom: '4px' } }, '缘起故事'),
      el('div', { style: { lineHeight: 1.8, whiteSpace:'pre-wrap', padding:'12px', background:'var(--c-cream-2)', borderRadius:'10px' } }, origin.story || '快来记录你们因第五人格相识的完整经历…')
    ])
  ]));
  app.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'row', style: { justifyContent:'space-between' } }, [
      el('h3', { style: { margin: 0 } }, '专属回忆相册'),
      el('button', { class: 'btn small primary', onclick: () => uploadOriginPhotosModal() }, '+ 上传截图'),
    ]),
    photos.length
      ? el('div', { class: 'tl-items', style: { marginTop: '12px' } },
          photos.map((p, pi) => el('div', { class: 'tl-card' }, [
            el('img', { src: p.path, onclick: () => lightbox(p.path, photos.map(x => x.path), pi) }),
            el('div', { class: 'tl-meta' }, [
              el('span', {}, fmtDate(p.created_at)),
              el('span', { html: roleIcon(p.author_role) }),
            ])
          ])))
      : emptyBox('上传你们的第一次同框截图吧'),
  ]));
}
function originField(label, value) {
  return el('div', { style: { padding:'10px 12px', background:'var(--c-cream-2)', borderRadius:'10px' } }, [
    el('div', { style: { fontSize:'12px', color:'var(--c-text-soft)' } }, label),
    el('div', { style: { marginTop:'4px', fontWeight: 600 } }, value),
  ]);
}
function editOrigin(o) {
  const form = el('form', { onsubmit: e => e.preventDefault() });
  form.innerHTML = `
    <div class="form-row"><label>相识日期</label><input type="date" name="meet_date" value="${o.meet_date ? fmtDate(o.meet_date) : ''}"></div>
    <div class="form-row"><label>第一次对局场景</label><input name="first_match" value="${escapeHtml(o.first_match || '')}"></div>
    <div class="form-row"><label>🦈 男生本命角色</label><input name="boy_character" value="${escapeHtml(o.boy_character || '')}"></div>
    <div class="form-row"><label>🐝 女生本命角色</label><input name="girl_character" value="${escapeHtml(o.girl_character || '')}"></div>
    <div class="form-row"><label>缘起故事</label><textarea name="story" rows="8">${escapeHtml(o.story || '')}</textarea></div>
  `;
  showModal({
    title: '编辑庄园缘起', body: form,
    onOk: async () => {
      const body = {
        meet_date: form.meet_date.value || null,
        first_match: form.first_match.value,
        boy_character: form.boy_character.value,
        girl_character: form.girl_character.value,
        story: form.story.value,
      };
      await api('/api/origin', { method:'PUT', body });
      toast('已保存'); closeModal(); route();
    }
  });
}
function uploadOriginPhotosModal() {
  const form = el('form', { onsubmit: e => e.preventDefault() });
  form.innerHTML = `
    <div class="form-row"><label>选择图片（可多张）</label><input type="file" name="files" accept="image/*" multiple></div>
    <div class="form-row"><label>备注</label><input name="remark" placeholder="第一次同框 / 初识截图…"></div>
  `;
  showModal({
    title: '上传缘起照片', body: form,
    pendingText: '正在压缩…',
    onOk: async () => {
      const fd = await buildUploadFormData(form);
      if (!fd.getAll('files').length || !fd.getAll('files')[0].size) { toast('请选择图片'); return false; }
      toast('正在上传，请稍候…');
      await api('/api/origin/photos', { method:'POST', body: fd });
      toast('已上传'); closeModal(); route();
    }
  });
}

/* -------- Settings -------- */
async function pageSettings(app) {
  await loadConfig();
  const c = App.config;
  app.innerHTML = '';
  app.appendChild(el('div', { class: 'page-title' }, [
    el('span', {}, '⚙️ 背景与设置'),
    el('small', {}, '自定义你们的二人世界')
  ]));

  // backgrounds
  const bgCard = el('div', { class: 'card' }, [ el('h3', { style: { margin:'0 0 12px' } }, '智能动态背景') ]);
  const slots = [
    ['boy_bg', '🦈 仅男生在线时', c.boy_bg],
    ['girl_bg', '🐝 仅女生在线时', c.girl_bg],
    ['both_bg', '💞 二人同栖时', c.both_bg],
  ];
  slots.forEach(([k, lb, url]) => {
    const fileInput = el('input', { type: 'file', accept: 'image/*', style: { display:'none' } });
    fileInput.onchange = async () => {
      if (!fileInput.files[0]) return;
      toast('正在压缩背景图…');
      const fd = new FormData();
      fd.append('slot', k); fd.append('file', await compressImageFile(fileInput.files[0]));
      toast('正在上传，请稍候…');
      await api('/api/config/background', { method:'POST', body: fd });
      toast('已更换背景'); pageSettings(app);
    };
    bgCard.appendChild(el('div', { class: 'bg-slot' }, [
      el('div', { class: 'preview', style: { backgroundImage: url ? `url("${url}")` : '' } }),
      el('div', { class: 'meta' }, [
        el('div', { class: 'lb' }, lb),
        el('div', { class: 'desc' }, url ? '已设置 · 切到对应在线状态自动展示' : '未设置 · 上传后自动生效')
      ]),
      el('div', { style: { display:'flex', flexDirection:'column', gap:'6px' } }, [
        el('button', { class: 'btn small', onclick: () => fileInput.click() }, '上传'),
        url ? el('button', { class: 'btn small danger', onclick: async () => {
          if (await confirmDialog('恢复默认背景？')) { await api('/api/config/background/'+k, { method:'DELETE' }); pageSettings(app); }
        } }, '清除') : null,
        fileInput,
      ])
    ]));
  });
  // pref
  const blur = el('input', { type: 'range', min: 0, max: 20, value: App.pref.blur || 0 });
  const opa = el('input', { type: 'range', min: 40, max: 100, value: App.pref.opacity ?? 86 });
  const savePref = async () => {
    App.pref = { blur: Number(blur.value), opacity: Number(opa.value) };
    applyBackground();
  };
  let saveTimer;
  const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => api('/api/config/pref', { method: 'PUT', body: App.pref }), 400); };
  const onSlide = () => { savePref(); persist(); };
  blur.oninput = onSlide; opa.oninput = onSlide;
  bgCard.appendChild(el('div', { style: { marginTop:'10px' } }, [
    el('div', { style: { fontSize:'12px', color:'var(--c-text-soft)' } }, '🌫️ 背景模糊度（你的偏好）'),
    blur,
    el('div', { style: { fontSize:'12px', color:'var(--c-text-soft)', marginTop:'10px' } }, '🪟 操作面板不透明度 · 调低可让背景更通透'),
    opa,
  ]));
  app.appendChild(bgCard);

  // global
  const globalCard = el('div', { class: 'card' }, [ el('h3', { style: { margin:'0 0 12px' } }, '全局设置（双方共享）') ]);
  const startInput = el('input', { type: 'date', value: c.love_start_date ? fmtDate(c.love_start_date) : '' });
  const footerInput = el('textarea', {}, c.footer_text || '');
  globalCard.appendChild(el('div', { class: 'form-row' }, [ el('label', {}, '相恋开始日期'), startInput ]));
  globalCard.appendChild(el('div', { class: 'form-row' }, [ el('label', {}, '页脚专属文案'), footerInput ]));
  globalCard.appendChild(el('div', { class: 'row-end' }, [
    el('button', { class: 'btn primary', onclick: async () => {
      await api('/api/config', { method:'PUT', body: { love_start_date: startInput.value || null, footer_text: footerInput.value } });
      toast('已保存'); await loadConfig(); $('#footerText').textContent = c.footer_text;
    } }, '保存')
  ]));
  app.appendChild(globalCard);

  // account profile
  const profCard = el('div', { class: 'card' }, [ el('h3', { style: { margin:'0 0 12px' } }, '账号资料') ]);
  const unameI = el('input', { value: App.user.username, placeholder: '账号名（字母数字下划线）' });
  const nickI = el('input', { value: App.user.nickname || '', placeholder: '昵称（可中文）' });
  profCard.appendChild(el('div', { class: 'form-row' }, [
    el('label', {}, `账号名（用于登录，当前角色：${App.user.role === 'boy' ? '🦈 漆黑烈焰使' : '🐝 邪王真眼使'}）`),
    unameI
  ]));
  profCard.appendChild(el('div', { class: 'form-row' }, [ el('label', {}, '昵称（顶部和留言都会显示）'), nickI ]));
  profCard.appendChild(el('div', { class: 'row-end' }, [
    el('button', { class: 'btn primary', onclick: async () => {
      const body = {};
      const u = unameI.value.trim();
      const n = nickI.value.trim();
      if (u && u !== App.user.username) body.username = u;
      if (n !== (App.user.nickname || '')) body.nickname = n;
      if (!Object.keys(body).length) { toast('没有要更新的内容'); return; }
      try {
        const data = await api('/api/auth/profile', { method: 'PUT', body });
        App.user = data.user;
        refreshMeBadge();
        toast('账号资料已更新');
      } catch (e) { toast(e.message); }
    } }, '保存账号资料')
  ]));
  app.appendChild(profCard);

  // password
  const pwCard = el('div', { class: 'card' }, [ el('h3', { style: { margin:'0 0 12px' } }, '修改密码') ]);
  const oldI = el('input', { type:'password', placeholder:'原密码' });
  const newI = el('input', { type:'password', placeholder:'新密码（≥4位）' });
  pwCard.appendChild(el('div', { class:'form-row' }, [ el('label', {}, '原密码'), oldI ]));
  pwCard.appendChild(el('div', { class:'form-row' }, [ el('label', {}, '新密码'), newI ]));
  pwCard.appendChild(el('div', { class:'row-end' }, [
    el('button', { class:'btn primary', onclick: async () => {
      try {
        await api('/api/auth/change-password', { method:'POST', body: { oldPassword: oldI.value, newPassword: newI.value } });
        toast('密码已更新'); oldI.value = newI.value = '';
      } catch (e) { toast(e.message); }
    } }, '更新密码')
  ]));
  app.appendChild(pwCard);

  // data export hint
  app.appendChild(el('div', { class: 'card', style: { textAlign:'center', color:'var(--c-text-soft)' }, html:
    `${mascotImgHtml('boy','mascot')} ${mascotImgHtml('girl','mascot')} 数据安全提示：所有数据保存在你们的私人服务器，记得定期备份 MySQL 数据库（love_forever）哦~`
  }));
}

/* ============================================================
   一起听歌（QQ 音乐 · 通过 MetingAPI 公共代理）
   ============================================================ */
App.music = App.music || { audio: null, last_seq: 0, song_id: '', poller: null, lrc: '', lrcLines: [] };

function ensureMusicAudio() {
  if (App.music.audio) return App.music.audio;
  const a = new Audio();
  a.preload = 'none';
  a.crossOrigin = 'anonymous';
  a.style.display = 'none';
  document.body.appendChild(a);
  App.music.audio = a;

  let pushTimer;
  const push = (partial) => {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushMusicState(partial).catch(() => {}), 250);
  };
  a.addEventListener('play', () => push({ is_playing: true, position: a.currentTime }));
  a.addEventListener('pause', () => {
    // 别在切歌瞬间把暂停状态推上去
    if (!a.src || a.ended) return;
    push({ is_playing: false, position: a.currentTime });
  });
  a.addEventListener('seeked', () => push({ position: a.currentTime, is_playing: !a.paused }));
  a.addEventListener('timeupdate', () => renderMusicProgress());
  a.addEventListener('ended', () => push({ is_playing: false, position: 0 }));
  return a;
}

async function pushMusicState(partial) {
  try {
    const r = await api('/api/music/state', { method: 'PUT', body: partial });
    App.music.last_seq = r.action_seq;
  } catch (e) {}
}

async function pollMusicState() {
  try {
    const { state: s } = await api('/api/music/state');
    if (!s) return;
    const seq = Number(s.action_seq || 0);
    if (seq <= App.music.last_seq) return;
    if (s.updated_by === App.user.id) { App.music.last_seq = seq; return; }
    await applyRemoteState(s);
    App.music.last_seq = seq;
    renderMusicHeader(s);
  } catch (e) {}
}

async function applyRemoteState(s) {
  const a = ensureMusicAudio();
  const songChanged = s.song_id && s.song_id !== App.music.song_id;
  if (songChanged) {
    App.music.song_id = s.song_id;
    App.music.song_name = s.song_name;
    App.music.artist = s.artist;
    App.music.cover = s.cover;
    App.music.lrc = s.lrc || '';
    App.music.lrcLines = parseLrc(App.music.lrc);
    try {
      const r = await api('/api/music/resolve?id=' + encodeURIComponent(s.song_id));
      a.src = r.url;
      if (r.cover) App.music.cover = r.cover;
      if (r.lrc && !App.music.lrc) { App.music.lrc = r.lrc; App.music.lrcLines = parseLrc(r.lrc); }
    } catch (e) { toast('解析对方播放的歌曲失败：' + e.message); return; }
  }
  const drift = (Date.now() - new Date(s.updated_at).getTime()) / 1000;
  const target = Math.max(0, (Number(s.position) || 0) + (s.is_playing ? drift : 0));
  if (Math.abs(a.currentTime - target) > 1.5 && isFinite(target)) {
    try { a.currentTime = target; } catch (e) {}
  }
  if (s.is_playing) {
    try { await a.play(); } catch (e) { toast('需要先点一下页面才能让浏览器自动播放哦~'); }
  } else {
    a.pause();
  }
  renderMusicHeader(s);
}

function parseLrc(text) {
  if (!text) return [];
  const lines = [];
  text.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\[(\d+):(\d+)(?:\.(\d+))?\](.*)$/);
    if (m) {
      const t = Number(m[1]) * 60 + Number(m[2]) + Number('0.' + (m[3] || '0'));
      const txt = m[4].trim();
      if (txt) lines.push({ t, txt });
    }
  });
  return lines.sort((a, b) => a.t - b.t);
}

function renderMusicProgress() {
  const a = App.music.audio;
  if (!a) return;
  const bar = document.getElementById('mu-prog-fill');
  const cur = document.getElementById('mu-cur');
  const dur = document.getElementById('mu-dur');
  if (bar && a.duration) bar.style.width = (a.currentTime / a.duration * 100) + '%';
  if (cur) cur.textContent = fmtSec(a.currentTime);
  if (dur) dur.textContent = fmtSec(a.duration);
  // lyrics
  const lrcBox = document.getElementById('mu-lrc');
  if (lrcBox && App.music.lrcLines.length) {
    let idx = 0;
    for (let i = 0; i < App.music.lrcLines.length; i++) {
      if (App.music.lrcLines[i].t <= a.currentTime) idx = i; else break;
    }
    [...lrcBox.children].forEach((el, i) => el.classList.toggle('active', i === idx));
    const active = lrcBox.children[idx];
    if (active) lrcBox.scrollTop = active.offsetTop - lrcBox.clientHeight / 2;
  }
  const pp = document.getElementById('mu-play');
  if (pp) pp.textContent = a.paused ? '▶' : '⏸';
}
function fmtSec(s) {
  if (!isFinite(s)) return '--:--';
  s = Math.floor(s);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function renderMusicHeader(s) {
  const head = document.getElementById('mu-now');
  if (!head) return;
  if (!s || !s.song_id) { head.innerHTML = '<span style="color:var(--c-text-soft)">暂无播放，搜索一首开始一起听吧 🎧</span>'; return; }
  const updaterIs = s.updated_by === App.user.id ? '你' : (s.updater_nickname || '对方');
  head.innerHTML = `
    <img class="mu-cover-sm" src="${escapeHtml(App.music.cover || s.cover || '')}" onerror="this.style.visibility='hidden'">
    <div>
      <div class="mu-title">${escapeHtml(s.song_name || '')}</div>
      <div class="mu-artist">${escapeHtml(s.artist || '')}</div>
      <div style="font-size:11px;color:var(--c-text-soft);margin-top:2px">由 ${escapeHtml(updaterIs)} 切换 · ${s.is_playing ? '播放中' : '已暂停'}</div>
    </div>`;
}

async function pageMusic(app) {
  app.innerHTML = '';
  app.appendChild(el('div', { class: 'page-title' }, [
    el('span', {}, '🎧 一起听歌'),
    el('small', {}, '搜一首歌，对方会同步听到')
  ]));

  ensureMusicAudio();

  // 状态条
  const headerCard = el('div', { class: 'card mu-header' }, [
    el('div', { id: 'mu-now', class: 'mu-now' }, '加载中…'),
  ]);
  app.appendChild(headerCard);

  // 播放器
  const playerCard = el('div', { class: 'card mu-player' });
  playerCard.innerHTML = `
    <div class="mu-controls">
      <button id="mu-play" class="mu-play-btn">▶</button>
      <span id="mu-cur" class="mu-time">--:--</span>
      <div id="mu-prog" class="mu-prog"><div id="mu-prog-fill" class="mu-prog-fill"></div></div>
      <span id="mu-dur" class="mu-time">--:--</span>
      <span style="font-size:12px;color:var(--c-text-soft);margin-left:8px">音量</span>
      <input id="mu-vol" type="range" min="0" max="100" value="80" style="width:90px">
    </div>
    <div id="mu-lrc" class="mu-lrc"></div>
  `;
  app.appendChild(playerCard);

  const a = App.music.audio;
  const playBtn = playerCard.querySelector('#mu-play');
  playBtn.onclick = () => {
    if (a.paused) a.play().catch(e => toast('播放失败：' + e.message));
    else a.pause();
  };
  const prog = playerCard.querySelector('#mu-prog');
  prog.onclick = (e) => {
    if (!a.duration) return;
    const r = prog.getBoundingClientRect();
    a.currentTime = (e.clientX - r.left) / r.width * a.duration;
  };
  const vol = playerCard.querySelector('#mu-vol');
  vol.value = Math.round((a.volume || 0.8) * 100);
  vol.oninput = () => { a.volume = vol.value / 100; };

  // 搜索
  const searchCard = el('div', { class: 'card' });
  const kwInput = el('input', { placeholder: '搜歌名 / 歌手（如：周杰伦 晴天）', style: { flex: 1 } });
  const goBtn = el('button', { class: 'btn primary' }, '搜索');
  const resultBox = el('div', { class: 'mu-results', style: { marginTop: '12px' } });
  searchCard.appendChild(el('h3', { style: { margin: '0 0 10px' } }, '🔎 搜索歌曲'));
  searchCard.appendChild(el('div', { class: 'row' }, [ kwInput, goBtn ]));
  searchCard.appendChild(resultBox);
  app.appendChild(searchCard);

  const doSearch = async () => {
    const kw = kwInput.value.trim();
    if (!kw) return;
    resultBox.innerHTML = '<div class="empty" style="padding:20px">搜索中…</div>';
    try {
      const { list } = await api('/api/music/search?kw=' + encodeURIComponent(kw));
      resultBox.innerHTML = '';
      if (!list.length) { resultBox.appendChild(emptyBox('没找到这首歌，换个关键词试试')); return; }
      list.forEach(s => {
        resultBox.appendChild(el('div', { class: 'mu-result' }, [
          s.pic ? el('img', { src: s.pic, onerror: e => e.target.style.visibility = 'hidden' }) : el('div', { class: 'mu-cover-sm' }, '🎵'),
          el('div', { class: 'mu-result-info' }, [
            el('div', { class: 'mu-title' }, s.name),
            el('div', { class: 'mu-artist' }, s.artist),
          ]),
          el('button', { class: 'btn small primary', onclick: () => playSong(s) }, '▶ 一起听'),
        ]));
      });
    } catch (e) {
      resultBox.innerHTML = '';
      resultBox.appendChild(emptyBox('搜索失败：' + e.message));
    }
  };
  goBtn.onclick = doSearch;
  kwInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });


  // 加载当前共享状态
  try {
    const { state: s } = await api('/api/music/state');
    if (s) {
      App.music.last_seq = Number(s.action_seq || 0);
      renderMusicHeader(s);
      if (s.song_id && s.song_id !== App.music.song_id) {
        // 不自动播放对方暂停中的歌，但拉取信息
        App.music.song_id = s.song_id;
        App.music.song_name = s.song_name;
        App.music.artist = s.artist;
        App.music.cover = s.cover;
        App.music.lrc = s.lrc || '';
        App.music.lrcLines = parseLrc(App.music.lrc);
        renderLrcLines();
      }
    } else {
      renderMusicHeader(null);
    }
  } catch (e) {}

  // 启动轮询
  if (App.music.poller) clearInterval(App.music.poller);
  App.music.poller = setInterval(pollMusicState, 2500);
}

function renderLrcLines() {
  const lrcBox = document.getElementById('mu-lrc');
  if (!lrcBox) return;
  lrcBox.innerHTML = '';
  if (!App.music.lrcLines.length) {
    lrcBox.innerHTML = '<div class="lrc-empty">这首歌还没有歌词哦~</div>';
    return;
  }
  App.music.lrcLines.forEach(l => {
    const d = document.createElement('div');
    d.className = 'lrc-line';
    d.textContent = l.txt;
    lrcBox.appendChild(d);
  });
}

async function playSong(s) {
  const a = ensureMusicAudio();
  try {
    const r = await api('/api/music/resolve?id=' + encodeURIComponent(s.id));
    if (!r.url) { toast('这首歌当前无法播放（可能版权受限）'); return; }
    a.src = r.url;
    App.music.song_id = s.id;
    App.music.song_name = s.name;
    App.music.artist = s.artist;
    App.music.cover = r.cover || s.pic || '';
    App.music.lrc = r.lrc || '';
    App.music.lrcLines = parseLrc(App.music.lrc);
    renderLrcLines();
    await a.play();
    await pushMusicState({
      song_id: s.id,
      song_name: s.name,
      artist: s.artist,
      cover: App.music.cover,
      lrc: App.music.lrc,
      position: 0,
      is_playing: true,
    });
    renderMusicHeader({
      song_id: s.id, song_name: s.name, artist: s.artist,
      is_playing: true, updated_by: App.user.id, updater_nickname: App.user.nickname
    });
  } catch (e) {
    toast('播放失败：' + e.message);
  }
}

/* ---------- Helpers ---------- */
function emptyBox(text) {
  const img = el('img', {
    class: 'doge-img',
    src: randomMascotUrl(),
    onerror: e => { e.target.outerHTML = '<div class="doge">🐶</div>'; }
  });
  return el('div', { class: 'empty' }, [
    img,
    el('div', {}, text),
  ]);
}

/* ---------- Go ---------- */
bootstrap();
