const db = require('../db');

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !(authHeader.startsWith("Bearer "))) {
        return res.status(401).json({ message: 'No token provided!' });
    }

    const token = authHeader.split(' ')[1];

    const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token);

    if (!session) {
        return res.status(401).json({ message: 'Invalid Token' });
    }

    const expired = new Date(session.expires_at) < new Date();

    if (expired) {
        return res.status(401).json({ message: 'Session Expired' });
    }

    req.user = { id: session.user_id };
    next();
}

module.exports = requireAuth;