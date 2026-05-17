const multer = require('multer');
const path = require('path');
const fs = require('fs');

function makeUploader(folder) {
  const dir = path.join(__dirname, '..', 'uploads', folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const safe = Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext;
      cb(null, safe);
    }
  });
  return multer({ storage, limits: { fileSize: 30 * 1024 * 1024 } });
}

module.exports = { makeUploader };
