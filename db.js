const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const DB_NAME = process.env.DB_NAME || 'love_forever';

const baseConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  charset: 'utf8mb4',
  multipleStatements: true,
};

const pool = mysql.createPool({
  ...baseConfig,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

async function ensureDatabase() {
  const conn = await mysql.createConnection(baseConfig);
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.end();
}

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('boy','girl') NOT NULL,
  nickname VARCHAR(50) DEFAULT '',
  last_seen DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS site_config (
  id INT PRIMARY KEY DEFAULT 1,
  boy_bg VARCHAR(500) DEFAULT '',
  girl_bg VARCHAR(500) DEFAULT '',
  both_bg VARCHAR(500) DEFAULT '',
  blur INT DEFAULT 0,
  opacity INT DEFAULT 100,
  love_start_date DATE DEFAULT '2024-01-01',
  footer_text VARCHAR(500) DEFAULT '始于第五人格，终于彼此相伴；漆黑烈焰使 × 邪王真眼使，鲨鱼与蜜蜂的永恒羁绊'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_prefs (
  user_id INT PRIMARY KEY,
  blur INT DEFAULT 0,
  opacity INT DEFAULT 100
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS anniversaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  type VARCHAR(40) DEFAULT 'custom',
  is_lunar TINYINT DEFAULT 0,
  remark TEXT,
  photo VARCHAR(500) DEFAULT '',
  remind_days INT DEFAULT 7,
  pinned TINYINT DEFAULT 0,
  author_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS albums (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  cover VARCHAR(500) DEFAULT '',
  description VARCHAR(500) DEFAULT '',
  author_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  path VARCHAR(500) NOT NULL,
  remark VARCHAR(500) DEFAULT '',
  author_id INT,
  taken_at DATETIME DEFAULT NULL,
  category VARCHAR(40) DEFAULT 'daily',
  album_id INT DEFAULT NULL,
  related_type VARCHAR(40) DEFAULT NULL,
  related_id INT DEFAULT NULL,
  media_type ENUM('image','video') DEFAULT 'image',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS album_views (
  id INT AUTO_INCREMENT PRIMARY KEY,
  album_id INT,
  viewer_id INT,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS todos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  remark TEXT,
  category VARCHAR(40) DEFAULT 'daily',
  status ENUM('pending','doing','done') DEFAULT 'pending',
  creator_id INT,
  confirmer_id INT DEFAULT NULL,
  due_date DATE DEFAULT NULL,
  done_at DATETIME DEFAULT NULL,
  photo VARCHAR(500) DEFAULT '',
  reflection TEXT,
  pinned TINYINT DEFAULT 0,
  reject_reason TEXT,
  rejected_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS travels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  cover VARCHAR(500) DEFAULT '',
  reason TEXT,
  tag VARCHAR(40) DEFAULT 'short',
  status ENUM('want','done') DEFAULT 'want',
  plan_date DATE DEFAULT NULL,
  done_at DATETIME DEFAULT NULL,
  pinned TINYINT DEFAULT 0,
  author_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS travel_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(20) DEFAULT '#FF6B6B',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS travel_media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  travel_id INT NOT NULL,
  path VARCHAR(500) NOT NULL,
  media_type ENUM('image','video') DEFAULT 'image',
  remark VARCHAR(500) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (travel_id) REFERENCES travels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS diaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content LONGTEXT NOT NULL,
  weather VARCHAR(40) DEFAULT '',
  author_id INT,
  likes INT DEFAULT 0,
  liked_by_other TINYINT DEFAULT 0,
  is_draft TINYINT DEFAULT 0,
  diary_date DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_diary_date (diary_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS diary_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  diary_id INT,
  author_id INT,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content TEXT NOT NULL,
  sender_id INT,
  receiver_id INT,
  is_read TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS capsules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content LONGTEXT NOT NULL,
  image VARCHAR(500) DEFAULT '',
  sender_id INT,
  receiver_id INT,
  unlock_at DATETIME NOT NULL,
  is_read TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS music_state (
  id INT PRIMARY KEY DEFAULT 1,
  server VARCHAR(20) DEFAULT 'tencent',
  song_id VARCHAR(60) DEFAULT '',
  song_name VARCHAR(255) DEFAULT '',
  artist VARCHAR(255) DEFAULT '',
  cover VARCHAR(500) DEFAULT '',
  lrc LONGTEXT,
  position FLOAT DEFAULT 0,
  is_playing TINYINT DEFAULT 0,
  action_seq BIGINT DEFAULT 0,
  updated_by INT DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS origin (
  id INT PRIMARY KEY DEFAULT 1,
  meet_date DATE DEFAULT NULL,
  first_match TEXT,
  boy_character VARCHAR(60) DEFAULT '',
  girl_character VARCHAR(60) DEFAULT '',
  story LONGTEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function ensureColumn(table, column, ddl) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [DB_NAME, table, column]
  );
  if (!rows[0].c) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
    console.log(`✓ 表 ${table} 已新增列 ${column}`);
  }
}

async function initDB() {
  await ensureDatabase();
  await pool.query(schema);

  // Migrations for already-existing databases
  await ensureColumn('todos', 'reject_reason', 'reject_reason TEXT');
  await ensureColumn('todos', 'rejected_at', 'rejected_at DATETIME DEFAULT NULL');
  await ensureColumn('photos', 'media_type', "media_type ENUM('image','video') DEFAULT 'image'");
  await ensureColumn('diaries', 'diary_date', 'diary_date DATETIME DEFAULT NULL');
  await pool.query('UPDATE diaries SET diary_date = created_at WHERE diary_date IS NULL');
  await pool.query('CREATE INDEX idx_diary_date ON diaries (diary_date)').catch(() => {});
  await pool.query('INSERT IGNORE INTO music_state (id) VALUES (1)');

  // Seed defaults
  const [users] = await pool.query('SELECT COUNT(*) AS c FROM users');
  if (users[0].c === 0) {
    const boyU = process.env.BOY_USERNAME || 'shark';
    const boyP = await bcrypt.hash(process.env.BOY_PASSWORD || 'shark520', 10);
    const girlU = process.env.GIRL_USERNAME || 'bee';
    const girlP = await bcrypt.hash(process.env.GIRL_PASSWORD || 'bee520', 10);
    await pool.query(
      'INSERT INTO users (username,password,role,nickname) VALUES (?,?,?,?),(?,?,?,?)',
      [boyU, boyP, 'boy', '漆黑烈焰使', girlU, girlP, 'girl', '邪王真眼使']
    );
    console.log('✓ 已创建默认账号');
  }
  const [cfg] = await pool.query('SELECT COUNT(*) AS c FROM site_config');
  if (cfg[0].c === 0) {
    await pool.query('INSERT INTO site_config (id) VALUES (1)');
  }
  const [og] = await pool.query('SELECT COUNT(*) AS c FROM origin');
  if (og[0].c === 0) {
    await pool.query('INSERT INTO origin (id) VALUES (1)');
  }
  console.log('✓ 数据库初始化完成');
}

module.exports = { pool, initDB };
