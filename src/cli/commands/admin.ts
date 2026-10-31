import { instance, apiError, authHeaders } from '../api.js';

export interface ActiveUser {
    id: number;
    username: string;
    expires_at: string;
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
