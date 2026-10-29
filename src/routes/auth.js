const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const requireAuth = require('../middleware/auth');

router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

        if (existingUser) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashedPassword);

        res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const user = db.prepare('SELECT id, password FROM users WHERE username = ?').get(username);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = uuidv4();
        const expiresAt = new Date();
        expiresAt.setUTCDate(expiresAt.getUTCDate() + 1);

        db.prepare('INSERT INTO sessions (token, expires_at, user_id) VALUES (?, ?, ?)').run(token, expiresAt.toISOString(), user.id);
        return res.status(200).json({ message: 'Login successful', token });
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/logout', requireAuth, (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
        return res.status(200).json({ message: 'Logged out.' });
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
