const db = require('../db');
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

router.get('/users', requireAuth, requireAdmin, (req, res) => {
    try {
        const activeUsers = db.prepare("SELECT users.id, users.username, sessions.expires_at FROM sessions INNER JOIN users ON sessions.user_id = users.id WHERE expires_at > datetime('now')").all();
        return res.status(200).json({ message: activeUsers });
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.delete('/users/:username/session', requireAuth, requireAdmin, (req, res) => {
    try {
        const userId = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);

        if (!userId) {
            return res.status(404).json({ message: 'User not found' });
        }

        db.prepare("UPDATE sessions SET expires_at = datetime('now') WHERE user_id = ?").run(userId.id);
        return res.status(200).json({ message: 'Session expired.' });
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
