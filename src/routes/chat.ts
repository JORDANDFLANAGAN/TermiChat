import express, { Request, Response } from 'express';
import db from '../db.js';
import requireAuth from '../middleware/auth.js';

const subscribers = new Map<number, Set<Response>>();

const router = express.Router();

interface RoomBody {
    name: string;
}

interface MessageBody {
    content: string;
}

// GET /chat/rooms — list all rooms
router.get('/rooms', requireAuth, (_req: Request, res: Response) => {
    try {
        const rooms = db.prepare('SELECT id, name, created_at FROM rooms ORDER BY created_at DESC').all();
        res.status(200).json({ rooms });
    } catch {
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// POST /chat/rooms — create a room
router.post('/rooms', requireAuth, (req: Request<{}, {}, RoomBody>, res: Response) => {
    try {
        const { name } = req.body;

        if (!name) {
            res.status(400).json({ message: 'Room name is required.' });
            return;
        }

        const existing = db.prepare('SELECT id FROM rooms WHERE name = ?').get(name);
        if (existing) {
            res.status(400).json({ message: 'A room with that name already exists.' });
            return;
        }

        const result = db.prepare(
            'INSERT INTO rooms (name, creator_id) VALUES (?, ?)'
        ).run(name, req.user!.id);

        db.prepare(
            'INSERT INTO members (room_id, user_id) VALUES (?, ?)'
        ).run(result.lastInsertRowid, req.user!.id);

        res.status(201).json({ message: 'Room created.', roomId: result.lastInsertRowid });
    } catch {
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// POST /chat/rooms/:roomId/join — join a room
router.post('/rooms/:roomId/join', requireAuth, (req: Request, res: Response) => {
    try {
        const roomId = Number(req.params.roomId);

        const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
        if (!room) {
            res.status(404).json({ message: 'Room not found.' });
            return;
        }

        const alreadyMember = db.prepare(
            'SELECT id FROM members WHERE room_id = ? AND user_id = ?'
        ).get(roomId, req.user!.id);

        if (alreadyMember) {
            res.status(400).json({ message: 'Already a member of this room.' });
            return;
        }

        db.prepare('INSERT INTO members (room_id, user_id) VALUES (?, ?)').run(roomId, req.user!.id);

        res.status(200).json({ message: 'Joined room.' });
    } catch {
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// POST /chat/rooms/:roomId/messages — post a message
router.post('/rooms/:roomId/messages', requireAuth, (req: Request<{ roomId: string }, {}, MessageBody>, res: Response) => {
    try {
        const roomId = Number(req.params.roomId);
        const { content } = req.body;

        if (!content) {
            res.status(400).json({ message: 'Message content is required.' });
            return;
        }

        const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
        if (!room) {
            res.status(404).json({ message: 'Room not found.' });
            return;
        }

        const isMember = db.prepare(
            'SELECT id FROM members WHERE room_id = ? AND user_id = ?'
        ).get(roomId, req.user!.id);

        if (!isMember) {
            res.status(403).json({ message: 'You are not a member of this room.' });
            return;
        }

        const result = db.prepare(
            'INSERT INTO messages (message_content, message_creator, room_id) VALUES (?, ?, ?)'
        ).run(content, req.user!.id, roomId);

        const newMessage = db.prepare(`
            SELECT messages.id, messages.message_content, messages.created_at, users.username
            FROM messages
            INNER JOIN users ON messages.message_creator = users.id
            WHERE messages.id = ?
        `).get(result.lastInsertRowid);

        broadcast(roomId, newMessage);

        res.status(201).json({ message: 'Message sent.', messageId: result.lastInsertRowid });
    } catch {
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// GET /chat/rooms/:roomId/messages — fetch last 50 messages
router.get('/rooms/:roomId/messages', requireAuth, (req: Request, res: Response) => {
    try {
        const roomId = Number(req.params.roomId);

        const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
        if (!room) {
            res.status(404).json({ message: 'Room not found.' });
            return;
        }

        const isMember = db.prepare(
            'SELECT id FROM members WHERE room_id = ? AND user_id = ?'
        ).get(roomId, req.user!.id);

        if (!isMember) {
            res.status(403).json({ message: 'You are not a member of this room.' });
            return;
        }

        const messages = db.prepare(`
            SELECT messages.id, messages.message_content, messages.created_at, users.username
            FROM messages
            INNER JOIN users ON messages.message_creator = users.id
            WHERE messages.room_id = ?
            ORDER BY messages.created_at DESC
            LIMIT 50
        `).all(roomId);

        res.status(200).json({ messages: messages.reverse() });
    } catch {
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// GET /chat/rooms/:roomId/stream — SSE stream for live messages
router.get('/rooms/:roomId/stream', requireAuth, (req: Request, res: Response) => {
    const roomId = Number(req.params.roomId);

    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
        res.status(404).json({ message: 'Room not found.' });
        return;
    }

    const isMember = db.prepare(
        'SELECT id FROM members WHERE room_id = ? AND user_id = ?'
    ).get(roomId, req.user!.id);

    if (!isMember) {
        res.status(403).json({ message: 'You are not a member of this room.' });
        return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    if (!subscribers.has(roomId)) subscribers.set(roomId, new Set());
    subscribers.get(roomId)!.add(res);

    req.on('close', () => {
        subscribers.get(roomId)?.delete(res);
    });
});

function broadcast(roomId: number, data: unknown): void {
    subscribers.get(roomId)?.forEach(client => {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    });
}

export default router;
