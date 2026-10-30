import axios from 'axios';
import { getToken } from '../token.js';

const instance = axios.create({
    baseURL: 'http://localhost:3000',
    timeout: 1000,
});

export async function listUsers(): Promise<void> {
    const token = getToken();
    if (!token) {
        console.log('Not logged in.');
        return;
    }
    try {
        const response = await instance.get('/admin/users', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Active users:');
        response.data.users.forEach((user: { username: string; expires_at: string }) => {
            console.log(`  ${user.username} (session expires: ${user.expires_at})`);
        });
    } catch (error) {
        console.log('Failed to fetch users.');
    }
}

export async function kickUser(username: string): Promise<void> {
    const token = getToken();
    if (!token) {
        console.log('Not logged in.');
        return;
    }
    try {
        const response = await instance.delete(`/admin/users/${username}/session`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(response.data.message);
    } catch (error) {
        console.log(`Failed to kick ${username}.`);
    }
}
