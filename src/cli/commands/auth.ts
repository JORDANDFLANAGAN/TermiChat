import axios from 'axios';
import { saveToken, getToken, deleteToken } from '../token.js';

const API = 'http://localhost:3000';

const instance = axios.create({
    baseURL: API,
    timeout: 1000,
});


export async function register(username: string, password: string): Promise<void> {
    try {
        const response = await instance.post('/auth/register', {
            username: username,
            password: password
        });
        console.log(response.data.message);
    } catch (error) {
        console.log('Error when registering user!');
    }
};

export async function login(username: string, password: string): Promise<void> {
    try {
        const response = await instance.post('/auth/login', {
            username: username,
            password: password
        });
        saveToken(response.data.token);
        console.log(response.data.message);
    } catch (error) {
        console.log('Issue while attempting Login!');
    }
};

export async function logout(): Promise<void> {
    const token = getToken();
    if (!token) {
        console.log('Not logged in.');
        return;
    }
    try {
        await instance.post('/auth/logout', {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        deleteToken();
        console.log('Logged out.');
    } catch (error) {
        console.log('Issue logging out!');
    }
}