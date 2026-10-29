import { Request, Response, NextFunction } from 'express';
import db from '../db.js';

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user!.id) as
        | { role: string }
        | undefined;

    if (!user || user.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden' });
        return;
    }

    next();
}

export default requireAdmin;
