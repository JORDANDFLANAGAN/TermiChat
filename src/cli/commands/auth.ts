import axios from 'axios';
import { saveToken, getToken, deleteToken } from '../token.js';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

const instance = axios.create({
    baseURL: BASE_URL,
    timeout: 5000,
});

function apiError(error: unknown): never {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
        throw new Error(error.response.data.message);
    }
    throw new Error('Request failed.');
}

export async function register(username: string, password: string): Promise<void> {
    try {
        await instance.post('/auth/register', { username, password });
    } catch (error) {
        apiError(error);
    }
}

export async function login(username: string, password: string): Promise<void> {
    try {
        const response = await instance.post('/auth/login', { username, password });
        saveToken(response.data.token);
    } catch (error) {
        apiError(error);
    }
}

export async function getMe(): Promise<{ id: number; username: string; role: string }> {
    try {
        const response = await instance.get('/auth/me', { headers: { Authorization: `Bearer ${getToken()}` } });
        return response.data;
    } catch (error) {
        apiError(error);
    }
}

export async function logout(): Promise<void> {
    const token = getToken();
    if (!token) throw new Error('Not logged in.');
    try {
        await instance.post('/auth/logout', {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
    } catch {
        // server rejection is fine — token may already be invalid
    } finally {
        deleteToken();
    }
}
