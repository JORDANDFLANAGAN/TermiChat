const db = require('../db');

function requireAdmin(req, res, next) {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);

    if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
    }
    next();
}

module.exports = requireAdmin;