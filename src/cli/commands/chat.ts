import axios from 'axios';
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
