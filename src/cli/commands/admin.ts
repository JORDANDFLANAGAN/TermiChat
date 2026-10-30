import axios from 'axios';
import { getToken } from '../token.js';

export interface ActiveUser {
    id: number;
    username: string;
    expires_at: string;
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

export async function listUsers(): Promise<ActiveUser[]> {
    const headers = authHeaders();
    try {
        const response = await instance.get('/admin/users', { headers });
        return response.data.users;
    } catch (error) {
        apiError(error);
    }
}

export async function kickUser(username: string): Promise<void> {
    const headers = authHeaders();
    try {
        await instance.delete(`/admin/users/${username}/session`, { headers });
    } catch (error) {
        apiError(error);
    }
}
