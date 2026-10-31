import { Request, Response, NextFunction } from 'express';

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    if (req.user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden' });
        return;
    }
    next();
}

export default requireAdmin;
