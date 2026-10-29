import express, { Request, Response } from 'express';
import db from '../db.js';
import requireAuth from '../middleware/auth.js';
import requireAdmin from '../middleware/requireAdmin.js';

const router = express.Router();

router.get('/users', requireAuth, requireAdmin, (_req: Request, res: Response) => {
    try {
        const activeUsers = db.prepare(`
            SELECT users.id, users.username, sessions.expires_at
            FROM sessions
            INNER JOIN users ON sessions.user_id = users.id
            WHERE expires_at > datetime('now')
        `).all();

        res.status(200).json({ users: activeUsers });
    } catch {
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.delete('/users/:username/session', requireAuth, requireAdmin, (req: Request, res: Response) => {
    try {
        const user = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username) as
            | { id: number }
            | undefined;

        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        db.prepare("UPDATE sessions SET expires_at = datetime('now') WHERE user_id = ?").run(user.id);
        res.status(200).json({ message: 'Session expired.' });
    } catch {
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
