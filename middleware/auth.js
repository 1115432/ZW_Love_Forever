function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: '羁绊通道未连接，请先登录' });
  }
  next();
}
module.exports = { requireAuth };
