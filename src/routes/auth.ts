import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import requireAuth from '../middleware/auth.js';

const router = express.Router();

interface AuthBody {
    username: string;
    password: string;
}

router.post('/register', async (req: Request<{}, {}, AuthBody>, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ message: 'Username and password are required' });
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

router.post('/login', async (req: Request<{}, {}, AuthBody>, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ message: 'Username and password are required' });
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
        const token = req.headers.authorization!.split(' ')[1];
        db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
        res.status(200).json({ message: 'Logged out.' });
    } catch {
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
