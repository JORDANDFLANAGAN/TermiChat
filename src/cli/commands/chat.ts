import http from 'http';
import https from 'https';
import { getToken } from '../token.js';
import { BASE_URL, instance, apiError, authHeaders } from '../api.js';

export interface Message {
    id: number;
    username: string;
    message_content: string;
    created_at: string;
}

export interface Room {
    id: number;
    name: string;
    is_member: 0 | 1;
}

const parsedBase = new URL(BASE_URL);

export async function createRoom(name: string): Promise<void> {
    try {
        await instance.post('/chat/rooms', { name }, { headers: authHeaders() });
    } catch (error) {
        apiError(error);
    }
}

export async function joinRoom(roomId: number): Promise<void> {
    try {
        await instance.post(`/chat/rooms/${roomId}/join`, {}, { headers: authHeaders() });
    } catch (error) {
        apiError(error);
    }
}

export async function sendMessage(roomId: number, content: string): Promise<void> {
    try {
        await instance.post(`/chat/rooms/${roomId}/messages`, { content }, { headers: authHeaders() });
    } catch (error) {
        apiError(error);
    }
}

export async function getMessages(roomId: number, before?: number): Promise<Message[]> {
    try {
        const response = await instance.get(`/chat/rooms/${roomId}/messages`, {
            headers: authHeaders(),
            params: before ? { before } : {},
        });
        return response.data.messages;
    } catch (error) {
        apiError(error);
    }
}

export async function deleteRoom(roomId: number): Promise<void> {
    try {
        await instance.delete(`/chat/rooms/${roomId}`, { headers: authHeaders() });
    } catch (error) {
        apiError(error);
    }
}

export async function leaveRoom(roomId: number): Promise<void> {
    try {
        await instance.delete(`/chat/rooms/${roomId}/leave`, { headers: authHeaders() });
    } catch (error) {
        apiError(error);
    }
}

export async function getRooms(): Promise<Room[]> {
    try {
        const response = await instance.get('/chat/rooms', { headers: authHeaders() });
        return response.data.rooms;
    } catch (error) {
        apiError(error);
    }
}

export type StreamStatus = 'connected' | 'reconnecting';

// Opens a persistent HTTP connection to the server's SSE endpoint for a given room.
// The server keeps this connection open and pushes a "data: {...}\n\n" frame each
// time a new message is posted (see broadcast() in routes/chat.ts).
// We use Node's built-in http module so we can pass auth headers — the browser
// EventSource API doesn't support headers, so we parse the stream manually instead.
// Reconnects automatically with exponential backoff if the connection drops.
// Returns a cleanup function — call it to close the connection when leaving the room.
export function streamMessages(
    roomId: number,
    onMessage: (msg: Message) => void,
    onStatusChange?: (status: StreamStatus) => void,
): () => void {
    const token = getToken();
    if (!token) return () => {};

    const transport = parsedBase.protocol === 'https:' ? https : http;
    let stopped = false;
    let currentReq: ReturnType<typeof transport.get> | null = null;
    let retryDelay = 1000;
    const MAX_DELAY = 30000;

    function connect() {
        if (stopped) return;

        let buffer = '';

        const req = transport.get({
            hostname: parsedBase.hostname,
            port: parsedBase.port || (parsedBase.protocol === 'https:' ? 443 : 80),
            path: `/chat/rooms/${roomId}/stream`,
            headers: { Authorization: `Bearer ${token}` },
        }, (res) => {
            retryDelay = 1000;
            onStatusChange?.('connected');

            res.on('data', (chunk: Buffer) => {
                buffer += chunk.toString();

                // SSE frames are separated by double newlines. Split on them,
                // keeping any incomplete frame in the buffer for the next chunk.
                const frames = buffer.split('\n\n');
                buffer = frames.pop() ?? '';

                for (const frame of frames) {
                    const dataLine = frame.split('\n').find(l => l.startsWith('data: '));
                    if (dataLine) {
                        try {
                            const msg = JSON.parse(dataLine.slice(6)) as Message;
                            onMessage(msg);
                        } catch {}
                    }
                }
            });

            res.on('end', scheduleReconnect);
        });

        req.on('error', scheduleReconnect);
        currentReq = req;
    }

    function scheduleReconnect() {
        if (stopped) return;
        onStatusChange?.('reconnecting');
        setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_DELAY);
    }

    connect();

    return () => {
        stopped = true;
        currentReq?.destroy();
    };
}
