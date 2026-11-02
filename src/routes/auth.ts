import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import requireAuth from '../middleware/auth.js';

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: 'Too many login attempts. Try again later.' },
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { message: 'Too many registration attempts. Try again later.' },
});

const router = express.Router();

interface AuthBody {
    username: string;
    password: string;
}

router.post('/register', registerLimiter, async (req: Request<{}, {}, AuthBody>, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ message: 'Username and password are required' });
            return;
        }

        if (password.length < 8) {
            res.status(400).json({ message: 'Password must be at least 8 characters.' });
            return;
        }

        if (username.length > 32) {
            res.status(400).json({ message: 'Username must be 32 characters or fewer.' });
            return;
        }

        const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

        if (existingUser) {
            res.status(400).json({ message: 'Username already taken' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashedPassword);

        res.status(201).json({ message: 'User created successfully' });
    } catch {
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/login', loginLimiter, async (req: Request<{}, {}, AuthBody>, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ message: 'Username and password are required' });
            return;
        }

        if (username.length > 32 || password.length > 128) {
            res.status(401).json({ message: 'Invalid credentials.' });
            return;
        }

        const user = db.prepare('SELECT id, password FROM users WHERE username = ?').get(username) as
            | { id: number; password: string }
            | undefined;

        if (!user || !(await bcrypt.compare(password, user.password))) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        const token = uuidv4();
        const expiresAt = new Date();
        expiresAt.setUTCDate(expiresAt.getUTCDate() + 1);

        db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
        db.prepare('INSERT INTO sessions (token, expires_at, user_id) VALUES (?, ?, ?)').run(
            token,
            expiresAt.toISOString(),
            user.id
        );

        res.status(200).json({ message: 'Login successful', token });
    } catch {
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/logout', requireAuth, (req: Request, res: Response) => {
    try {
        db.prepare('DELETE FROM sessions WHERE token = ?').run(req.user!.token);
        res.status(200).json({ message: 'Logged out.' });
    } catch {
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/me', requireAuth, (req: Request, res: Response) => {
    try {
        const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(req.user!.id) as
            | { id: number; username: string; role: string }
            | undefined;

        if (!user) {
            res.status(404).json({ message: 'User not found.' });
            return;
        }

        res.status(200).json(user);
    } catch {
        res.status(500).json({ message: 'Internal server error.' });
    }
});

export default router;
