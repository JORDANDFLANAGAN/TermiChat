import { Request, Response, NextFunction } from 'express';
import db from '../db.js';

function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'No token provided' });
        return;
    }

    const token = authHeader.split(' ')[1];
    const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token) as
        | { user_id: number; expires_at: string }
        | undefined;

    if (!session) {
        res.status(401).json({ message: 'Invalid token' });
        return;
    }

    if (new Date(session.expires_at) < new Date()) {
        res.status(401).json({ message: 'Session expired' });
        return;
    }

    req.user = { id: session.user_id };
    next();
}

export default requireAuth;
