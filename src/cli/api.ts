import axios from 'axios';
import { getToken } from './token.js';

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

export const instance = axios.create({
    baseURL: BASE_URL,
    timeout: 5000,
});

export function apiError(error: unknown): never {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
        throw new Error(error.response.data.message);
    }
    throw new Error('Request failed.');
}

export function authHeaders() {
    const token = getToken();
    if (!token) throw new Error('Not logged in.');
    return { Authorization: `Bearer ${token}` };
}
