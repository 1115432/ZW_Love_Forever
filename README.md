# Love Forever · 双人专属恋爱网站 🦈🐝

> 始于第五人格，终于彼此相伴 — 漆黑烈焰使 × 邪王真眼使

按规格文档完整实现：登录、动态背景、纪念日、时间线照片墙、相册、日记、悄悄话留言板、未做之事、期待旅行、时光胶囊、庄园缘起 + 双端响应式。

## 技术栈

- 后端：Node.js + Express + MySQL（mysql2）
- 前端：原生 HTML/CSS/JS SPA（hash 路由，无构建工具）
- 文件上传：multer，本地 `uploads/` 目录
- 会话：express-session（30 天 / 90 天可选）

## 环境要求

- Node.js ≥ 16
- MySQL ≥ 5.7（账号 `root` / 密码 `52beibei`，默认 127.0.0.1:3306）

## 启动步骤

```bash
# 1. 安装依赖
npm install

# 2. 启动（首次运行自动创建数据库 love_forever 与所有表 + 默认账号）
npm start
```

默认运行端口：**5200**（避开 1080）。访问：<http://localhost:5200>

## 默认账号

| 身份 | 账号 | 密码 |
|---|---|---|
| 🦈 漆黑烈焰使（男生） | `shark` | `shark520` |
| 🐝 邪王真眼使（女生） | `bee` | `bee520` |

登录后请在「⚙️ 背景与设置」→ 修改密码 中改成你们的专属密钥。

> 账号也可以在启动前通过 `.env` 中的 `BOY_USERNAME / BOY_PASSWORD / GIRL_USERNAME / GIRL_PASSWORD` 自定义（仅在数据库为空时生效）。

## 目录结构

```
.
├─ server.js              入口
├─ db.js                  连接池 + 建表 + 种子数据
├─ routes/                10 个模块 REST API
├─ middleware/            auth、upload
├─ public/                前端 SPA + 登录页 + 404
│   ├─ index.html
│   ├─ login.html
│   ├─ 404.html
│   ├─ styles.css
│   └─ app.js             所有页面渲染逻辑
├─ uploads/               用户上传文件（自动创建）
├─ .env                   端口、数据库、默认账号
└─ package.json
```

## 功能对照文档

| 模块 | 路径 | 状态 |
|---|---|---|
| 登录 + 记住我 | `/login.html` | ✓ |
| 在线状态心跳 + 动态背景 | `/api/status` `/api/config` | ✓ 单/双切换、模糊度、不透明度 |
| 首页恋爱总览 + 计时 | `#/home` | ✓ 实时秒级，公历日期 |
| 纪念日 | `#/anniversaries` | ✓ 倒计时、置顶、农历标记、提前提醒字段、照片 |
| 时间线照片墙 | `#/timeline` | ✓ 按月分组、双端布局、灯箱预览 |
| 私密相册 | `#/albums` | ✓ 多相册、封面、批量、访问记录 |
| 恋爱日记 | `#/diaries` | ✓ 富文本、点赞、评论、搜索 |
| 悄悄话留言板 | `#/messages` | ✓ 已读状态、撤回 |
| 未做之事 | `#/todos` | ✓ 三状态、打卡照片、心得、进度条、徽章 |
| 期待旅行 | `#/travels` | ✓ 标签、打卡、走过的地方 |
| 时光胶囊 | `#/capsules` | ✓ 定时解锁、解锁弹窗提醒 |
| 庄园缘起 | `#/origin` | ✓ 初识档案、专属相册、本命角色 |
| 设置 | `#/settings` | ✓ 3 套背景、双方共享/独立偏好 |
| 404 + 线条小狗 | `/404.html` | ✓ |

## 私密性

- 仅两个固定账号可访问，无注册入口
- 所有 API 均要求登录态（401 自动跳转登录）
- 数据存于本地 MySQL，照片存于 `uploads/`
- 建议定期 `mysqldump -uroot -p love_forever > backup.sql` 备份

## 双端适配

- 电脑端：侧边导航 + 多列卡片 + 照片墙交错排版
- 手机端：汉堡菜单 + 单列垂直 + 大按钮 + 16px 输入框（防 iOS 缩放）

## 自定义

- 修改端口：编辑 `.env` 的 `PORT`
- 修改 MySQL：编辑 `.env` 的 `DB_*`
- 修改页脚文案、相恋开始日：登录后在「⚙️ 背景与设置」中修改

---

🐶 线条小狗祝你们羁绊永恒。
