import express, { Request, Response } from 'express';
import db from '../db.js';
import requireAuth from '../middleware/auth.js';
import requireAdmin from '../middleware/requireAdmin.js';

const subscribers = new Map<number, Set<Response>>();

const router = express.Router();

interface RoomBody {
    name: string;
}

interface MessageBody {
    content: string;
}

interface MessageRow {
    id: number;
    message_content: string;
    created_at: string;
    username: string;
}

// GET /chat/rooms — list all rooms, with is_member and unread_count for the requesting user
router.get('/rooms', requireAuth, (req: Request, res: Response) => {
    try {
        const rooms = db.prepare(`
            SELECT rooms.id, rooms.name, rooms.created_at,
                   CASE WHEN members.user_id IS NOT NULL THEN 1 ELSE 0 END as is_member,
                   CASE
                       WHEN members.user_id IS NOT NULL THEN (
                           SELECT COUNT(*) FROM messages
                           WHERE messages.room_id = rooms.id
                           AND messages.id > members.last_read_id
                       )
                       ELSE 0
                   END as unread_count
            FROM rooms
            LEFT JOIN members ON members.room_id = rooms.id AND members.user_id = ?
            ORDER BY rooms.created_at DESC
        `).all(req.user!.id);
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

        if (name.length > 32) {
            res.status(400).json({ message: 'Room name must be 32 characters or fewer.' });
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

// DELETE /chat/rooms/:roomId — admin only, deletes the room and all its messages and members
router.delete('/rooms/:roomId', requireAuth, requireAdmin, (req: Request, res: Response) => {
    try {
        const roomId = Number(req.params.roomId);

        const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
        if (!room) {
            res.status(404).json({ message: 'Room not found.' });
            return;
        }

        db.transaction(() => {
            db.prepare('DELETE FROM messages WHERE room_id = ?').run(roomId);
            db.prepare('DELETE FROM members WHERE room_id = ?').run(roomId);
            db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
        })();

        subscribers.delete(roomId);

        res.status(200).json({ message: 'Room deleted.' });
    } catch {
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// POST /chat/rooms/:roomId/read — advance the caller's last_read_id to the current newest message
router.post('/rooms/:roomId/read', requireAuth, (req: Request, res: Response) => {
    try {
        const roomId = Number(req.params.roomId);

        const isMember = db.prepare(
            'SELECT id FROM members WHERE room_id = ? AND user_id = ?'
        ).get(roomId, req.user!.id);

        if (!isMember) {
            res.status(403).json({ message: 'You are not a member of this room.' });
            return;
        }

        db.prepare(`
            UPDATE members SET last_read_id = COALESCE(
                (SELECT MAX(id) FROM messages WHERE room_id = ?), 0
            ) WHERE room_id = ? AND user_id = ?
        `).run(roomId, roomId, req.user!.id);

        res.status(200).json({ message: 'Marked as read.' });
    } catch {
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// DELETE /chat/rooms/:roomId/leave — remove yourself from a room's members
router.delete('/rooms/:roomId/leave', requireAuth, (req: Request, res: Response) => {
    try {
        const roomId = Number(req.params.roomId);

        const isMember = db.prepare(
            'SELECT id FROM members WHERE room_id = ? AND user_id = ?'
        ).get(roomId, req.user!.id);

        if (!isMember) {
            res.status(400).json({ message: 'You are not a member of this room.' });
            return;
        }

        db.prepare('DELETE FROM members WHERE room_id = ? AND user_id = ?')
            .run(roomId, req.user!.id);

        res.status(200).json({ message: 'Left room.' });
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

        if (content.length > 2000) {
            res.status(400).json({ message: 'Message must be 2000 characters or fewer.' });
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

// GET /chat/rooms/:roomId/messages — fetch last 50 messages, or 50 before a given message id
// The optional ?before=<id> param is used for pagination: pass the oldest loaded message's id
// to get the next batch of older messages.
router.get('/rooms/:roomId/messages', requireAuth, (req: Request, res: Response) => {
    try {
        const roomId = Number(req.params.roomId);
        const before = req.query.before ? Number(req.query.before) : null;

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

        const messages = before
            ? db.prepare(`
                SELECT messages.id, messages.message_content, messages.created_at, users.username
                FROM messages
                INNER JOIN users ON messages.message_creator = users.id
                WHERE messages.room_id = ? AND messages.id < ?
                ORDER BY messages.created_at DESC LIMIT 50
            `).all(roomId, before)
            : db.prepare(`
                SELECT messages.id, messages.message_content, messages.created_at, users.username
                FROM messages
                INNER JOIN users ON messages.message_creator = users.id
                WHERE messages.room_id = ?
                ORDER BY messages.created_at DESC LIMIT 50
            `).all(roomId);

        res.status(200).json({ messages: (messages as MessageRow[]).reverse() });
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

export function closeAllConnections(): void {
    subscribers.forEach(clients => clients.forEach(client => client.end()));
    subscribers.clear();
}

export default router;
