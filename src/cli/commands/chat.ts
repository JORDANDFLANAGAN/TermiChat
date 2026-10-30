import axios from 'axios';
import EventSource from 'eventsource';
import { getToken } from '../token.js';

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

const instance = axios.create({
    baseURL: 'http://localhost:3000',
    timeout: 5000,
});

function apiError(error: unknown): never {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
        throw new Error(error.response.data.message);
    }
    throw new Error('Request failed.');
}

function authHeaders() {
    const token = getToken();
    if (!token) throw new Error('Not logged in.');
    return { Authorization: `Bearer ${token}` };
}

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

export async function getMessages(roomId: number): Promise<Message[]> {
    try {
        const response = await instance.get(`/chat/rooms/${roomId}/messages`, { headers: authHeaders() });
        return response.data.messages;
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

// Opens a persistent HTTP connection to the server's SSE endpoint for a given room.
// The server keeps this connection open and pushes a "data: {...}" line each time
// a new message is posted to the room (see broadcast() in routes/chat.ts).
// We parse each incoming event and hand the message to the caller via onMessage.
// Returns a cleanup function — call it to close the connection when leaving the room.
export function streamMessages(roomId: number, onMessage: (msg: Message) => void): () => void {
    const token = getToken();
    if (!token) return () => {};

    // eventsource is a Node.js polyfill for the browser's EventSource API.
    // We pass the auth token as a header because SSE is just a plain GET request.
    const es = new EventSource(`http://localhost:3000/chat/rooms/${roomId}/stream`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    // Fires once per "data: ...\n\n" frame the server sends.
    es.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data) as Message;
            onMessage(msg);
        } catch {}
    };

    return () => es.close();
}
