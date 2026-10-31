import { saveToken, getToken, deleteToken } from '../token.js';
import { instance, apiError, authHeaders } from '../api.js';

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
        const response = await instance.get('/auth/me', { headers: authHeaders() });
        return response.data;
    } catch (error) {
        apiError(error);
    }
}

export async function logout(): Promise<void> {
    try {
        await instance.post('/auth/logout', {}, { headers: authHeaders() });
    } catch {
        // server rejection is fine — token may already be invalid
    } finally {
        deleteToken();
    }
}
